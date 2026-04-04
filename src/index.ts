import type { Plugin } from "@opencode-ai/plugin"
import type { Permission, Event } from "@opencode-ai/sdk"

interface PermissionEvent {
  tool: string
  pattern: string
  outcome: "granted" | "denied"
}

class PermissionTracker {
  private events: PermissionEvent[] = []

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
  }

  hasEvents(): boolean {
    return this.events.length > 0
  }
}

const tracker = new PermissionTracker()

export const PermissionExportPlugin: Plugin = async (ctx) => {
  return {
    "permission.ask": async (input: Permission, output) => {
      if (output.status === "allow") {
        const tool = input.type
        const pattern = extractPattern(input)
        tracker.add({ tool, pattern, outcome: "granted" })
      }
    },

    event: async (input: { event: Event }) => {
      if (input.event.type === "permission.replied") {
        const props = input.event.properties
        if (props.response === "allow") {
          tracker.add({ tool: "unknown", pattern: props.permissionID, outcome: "granted" })
        }
      }
    },
  }
}

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

export default PermissionExportPlugin
