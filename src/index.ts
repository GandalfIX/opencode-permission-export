import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import type { Event } from "@opencode-ai/sdk"

interface StoredPermission {
  id: string
  type: string
  patterns: string[]
  metadata: Record<string, unknown>
}

interface PermissionEvent {
  tool: string
  pattern: string
  outcome: "granted" | "denied"
  replyType: "once" | "always"
}

class PermissionTracker {
  private events: PermissionEvent[] = []
  private pendingPermissions: Map<string, StoredPermission> = new Map()

  storePermission(permission: StoredPermission): void {
    this.pendingPermissions.set(permission.id, permission)
  }

  getPermission(id: string): StoredPermission | undefined {
    return this.pendingPermissions.get(id)
  }

  add(event: PermissionEvent): void {
    const exists = this.events.some(
      (e) => e.tool === event.tool && e.pattern === event.pattern && e.outcome === event.outcome && e.replyType === event.replyType
    )
    if (!exists) {
      this.events.push(event)
    }
  }

  getGranted(): PermissionEvent[] {
    return this.events.filter((e) => e.outcome === "granted")
  }

  getDenied(): PermissionEvent[] {
    return this.events.filter((e) => e.outcome === "denied")
  }

  getAlways(): PermissionEvent[] {
    return this.events.filter((e) => e.outcome === "granted" && e.replyType === "always")
  }

  clear(): void {
    this.events = []
    this.pendingPermissions.clear()
  }

  hasEvents(): boolean {
    return this.events.length > 0
  }
}

const tracker = new PermissionTracker()

function extractPattern(permission: StoredPermission): string {
  if (permission.patterns && permission.patterns.length > 0) {
    return permission.patterns.join(",")
  }
  const metadata = permission.metadata
  if (typeof metadata.command === "string") return metadata.command
  if (typeof metadata.filePath === "string") return metadata.filePath
  if (typeof metadata.path === "string") return metadata.path
  if (typeof metadata.url === "string") return metadata.url
  if (typeof metadata.query === "string") return metadata.query
  return "*"
}

function extractCommandGroup(pattern: string): string {
  const firstCommand = pattern.split(",")[0]?.trim() ?? pattern
  const parts = firstCommand.split(/\s+/)
  return parts[0] ?? "*"
}

interface GroupOptions {
  minGroupSize?: number
  excludeCommands?: string[]
}

const DEFAULT_EXCLUDE_COMMANDS = ["rm", "sudo", "curl", "wget"]

function groupPermissions(events: PermissionEvent[], options: GroupOptions = {}): PermissionEvent[] {
  const { minGroupSize = 2, excludeCommands = DEFAULT_EXCLUDE_COMMANDS } = options
  const groups = new Map<string, PermissionEvent>()

  for (const event of events) {
    if (event.tool !== "bash") {
      groups.set(`${event.tool}:${event.pattern}`, event)
      continue
    }

    const commandGroup = extractCommandGroup(event.pattern)

    if (excludeCommands.includes(commandGroup)) {
      groups.set(`${event.tool}:${event.pattern}`, event)
      continue
    }

    const groupKey = `${event.tool}:${commandGroup}:*`
    if (groups.has(groupKey)) continue

    const sameGroupCount = events.filter(
      e => e.tool === "bash" && extractCommandGroup(e.pattern) === commandGroup
    ).length

    if (sameGroupCount >= minGroupSize) {
      groups.set(groupKey, { tool: "bash", pattern: `${commandGroup}:*`, outcome: event.outcome, replyType: event.replyType })
    } else {
      groups.set(`${event.tool}:${event.pattern}`, event)
    }
  }

  return Array.from(groups.values())
}

function generateConfig(events: PermissionEvent[], skipGrouping = false): Record<string, unknown> {
  const grouped = skipGrouping ? events : groupPermissions(events)
  const permission: Record<string, Record<string, string>> = {}

  for (const event of grouped) {
    if (!permission[event.tool]) {
      permission[event.tool] = {}
    }
    permission[event.tool][event.pattern] = "allow"
  }

  return { permission }
}

function generateIndividualConfigs(events: PermissionEvent[]): Record<string, unknown>[] {
  return events.map(event => ({
    permission: {
      [event.tool]: {
        [event.pattern]: "allow"
      }
    }
  }))
}

export const PermissionExportPlugin: Plugin = async (ctx) => {
  return {
    event: async (input: { event: Event }) => {
      const event = input.event as unknown as { type: string; properties: unknown }
      if (event.type === "permission.asked") {
        const props = event.properties as { id: string; permission: string; patterns: string[]; metadata?: Record<string, unknown> }
        tracker.storePermission({ id: props.id, type: props.permission, patterns: props.patterns, metadata: props.metadata || {} })
      }
      if (event.type === "permission.replied") {
        const props = event.properties as { requestID: string; reply: string }
        const permission = tracker.getPermission(props.requestID)
        if (permission && (props.reply === "once" || props.reply === "always")) {
          const tool = permission.type
          const pattern = extractPattern(permission)
          tracker.add({ tool, pattern, outcome: "granted", replyType: props.reply as "once" | "always" })
        }
      }
    },

    tool: {
      "export-permissions": tool({
        description: "Export granted permissions as opencode config snippet. Paste the output into your opencode.json.",
        args: {
          format: tool.schema.enum(["combined", "individual"]).optional().default("combined").describe("Export format: 'combined' groups related commands (e.g., git:*), 'individual' exports each permission separately"),
          filter: tool.schema.enum(["all", "always"]).optional().default("all").describe("Filter permissions: 'all' includes all granted permissions, 'always' only includes permissions granted with 'always'")
        },
        async execute(args, context) {
          if (!tracker.hasEvents()) {
            return "No permissions have been asked this session."
          }

          const granted = args.filter === "always" ? tracker.getAlways() : tracker.getGranted()
          const denied = tracker.getDenied()
          if (granted.length === 0) {
            if (args.filter === "always") {
              return `No permissions were granted with "always". ${denied.length} request(s) were denied.`
            }
            return `No permissions were granted. ${denied.length} request(s) were denied.`
          }

          const deniedNote = denied.length > 0 ? `\n\nNote: ${denied.length} permission(s) were denied and not included.` : ""
          const filterSuffix = args.filter === "always" ? " (always only)" : ""

          if (args.format === "individual") {
            const configs = generateIndividualConfigs(granted)
            const output = configs.map(c => JSON.stringify(c)).join("\n")
            return `Copy these into your opencode.json (individual format${filterSuffix}):\n\n${output}${deniedNote}`
          }

          const config = generateConfig(granted, false)
          return `Copy this into your opencode.json (combined format${filterSuffix}):\n\n${JSON.stringify(config, null, 2)}${deniedNote}`
        },
      }),
    },
  }
}

export default PermissionExportPlugin

export { extractCommandGroup, groupPermissions, generateConfig }
export type { PermissionEvent }
