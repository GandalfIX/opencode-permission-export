import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import type { Event } from "@opencode-ai/sdk"
import { appendFileSync } from "fs"

const log = (...args: unknown[]) => {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ') + '\n'
  appendFileSync("event-log.txt", message)
}

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
    event: async (input: { event: Event }) => {
      const event = input.event as unknown as { type: string; properties: unknown }
      log("[permission-export] event triggered")
      log("[permission-export]   event type:", event.type)
      log("[permission-export]   event:", JSON.stringify(event, null, 2))
      if (event.type === "permission.asked") {
        const props = event.properties as { id: string; permission: string; patterns: string[]; metadata?: Record<string, unknown> }
        tracker.storePermission({ id: props.id, type: props.permission, patterns: props.patterns, metadata: props.metadata || {} })
        log("[permission-export]   stored permission id:", props.id)
      }
      if (event.type === "permission.replied") {
        const props = event.properties as { requestID: string; reply: string }
        log("[permission-export]   requestID:", props.requestID)
        log("[permission-export]   reply:", props.reply)
        const permission = tracker.getPermission(props.requestID)
        log("[permission-export]   found permission:", permission ? "yes" : "no")
        if (permission && (props.reply === "once" || props.reply === "always")) {
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
