import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import type { Permission, Event } from "@opencode-ai/sdk"

interface PermissionEvent {
  tool: string
  pattern: string
  outcome: "granted" | "denied"
}

class PermissionTracker {
  private events: PermissionEvent[] = []
  private pendingPermissions: Map<string, Permission> = new Map()

  storePermission(permission: Permission): void {
    this.pendingPermissions.set(permission.id, permission)
  }

  getPermission(id: string): Permission | undefined {
    return this.pendingPermissions.get(id)
  }

  add(event: PermissionEvent): void {
    const exists = this.events.some(
      (e) => e.tool === event.tool && e.pattern === event.pattern && e.outcome === event.outcome
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

  clear(): void {
    this.events = []
    this.pendingPermissions.clear()
  }

  hasEvents(): boolean {
    return this.events.length > 0
  }
}

const tracker = new PermissionTracker()

function extractPattern(input: Permission): string {
  if (input.pattern) {
    return Array.isArray(input.pattern) ? input.pattern.join(",") : input.pattern
  }
  const metadata = input.metadata
  if (typeof metadata.command === "string") return metadata.command
  if (typeof metadata.filePath === "string") return metadata.filePath
  if (typeof metadata.path === "string") return metadata.path
  if (typeof metadata.url === "string") return metadata.url
  if (typeof metadata.query === "string") return metadata.query
  return "*"
}

function generateConfig(events: PermissionEvent[]): Record<string, unknown> {
  const permission: Record<string, Record<string, string>> = {}

  for (const event of events) {
    if (!permission[event.tool]) {
      permission[event.tool] = {}
    }
    permission[event.tool][event.pattern] = "allow"
  }

  return { permission }
}

export const PermissionExportPlugin: Plugin = async (ctx) => {
  return {
    "permission.ask": async (input: Permission, output) => {
      tracker.storePermission(input)
      if (output.status === "allow") {
        const tool = input.type
        const pattern = extractPattern(input)
        tracker.add({ tool, pattern, outcome: "granted" })
      }
    },

    event: async (input: { event: Event }) => {
      if (input.event.type === "permission.replied") {
        const props = input.event.properties
        const permission = tracker.getPermission(props.permissionID)
        if (permission && props.response === "allow") {
          const tool = permission.type
          const pattern = extractPattern(permission)
          tracker.add({ tool, pattern, outcome: "granted" })
        }
      }
    },

    tool: {
      "export-permissions": tool({
        description: "Export granted permissions as opencode config snippet. Paste the output into your opencode.json.",
        args: {},
        async execute(_args, _context) {
          if (!tracker.hasEvents()) {
            return "No permissions have been asked this session."
          }

          const granted = tracker.getGranted()
          if (granted.length === 0) {
            const denied = tracker.getDenied()
            return `No permissions were granted. ${denied.length} request(s) were denied.`
          }

          const config = generateConfig(granted)
          const denied = tracker.getDenied()
          const deniedNote = denied.length > 0 ? `\n\nNote: ${denied.length} permission(s) were denied and not included.` : ""

          return `Copy this into your opencode.json:\n\n${JSON.stringify(config, null, 2)}${deniedNote}`
        },
      }),
    },
  }
}

export default PermissionExportPlugin
