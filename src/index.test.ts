import { describe, it, expect } from "vitest"
import { extractCommandGroup, groupPermissions, generateConfig } from "./index.js"
import type { PermissionEvent } from "./index.js"

describe("extractCommandGroup", () => {
  it("extracts git command group", () => {
    expect(extractCommandGroup("git status")).toBe("git")
    expect(extractCommandGroup("git diff abafd15..a7d1836")).toBe("git")
  })

  it("extracts package manager commands", () => {
    expect(extractCommandGroup("pnpm dev")).toBe("pnpm")
    expect(extractCommandGroup("npm test -- --run")).toBe("npm")
  })

  it("handles comma-separated commands", () => {
    expect(extractCommandGroup("git status,git diff --stat")).toBe("git")
  })

  it("returns first word for unknown commands", () => {
    expect(extractCommandGroup("mkdir -p dir")).toBe("mkdir")
  })
})

describe("groupPermissions", () => {
  it("groups git commands under git:*", () => {
    const events: PermissionEvent[] = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
    ]
    expect(groupPermissions(events)).toEqual([
      { tool: "bash", pattern: "git:*", outcome: "granted" },
    ])
  })

  it("keeps single commands as-is", () => {
    const events: PermissionEvent[] = [
      { tool: "bash", pattern: "pnpm dev", outcome: "granted" },
    ]
    expect(groupPermissions(events)).toEqual(events)
  })

  it("preserves non-bash tools unchanged", () => {
    const events: PermissionEvent[] = [
      { tool: "edit", pattern: "file.ts", outcome: "granted" },
    ]
    expect(groupPermissions(events)).toEqual(events)
  })
})

describe("groupPermissions threshold", () => {
  it("respects minimum threshold", () => {
    const events: PermissionEvent[] = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
    ]
    expect(groupPermissions(events, { minGroupSize: 3 })).toEqual(events)
  })
})

describe("generateConfig with grouping", () => {
  it("outputs grouped permissions", () => {
    const events: PermissionEvent[] = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
      { tool: "bash", pattern: "pnpm build", outcome: "granted" },
      { tool: "bash", pattern: "pnpm test", outcome: "granted" },
    ]
    const result = generateConfig(events) as { permission: Record<string, Record<string, string>> }
    expect(result.permission.bash).toEqual({
      "git:*": "allow",
      "pnpm:*": "allow",
    })
  })
})

describe("generateConfig with skipGrouping", () => {
  it("outputs individual permissions when skipGrouping is true", () => {
    const events: PermissionEvent[] = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
    ]
    const result = generateConfig(events, true) as { permission: Record<string, Record<string, string>> }
    expect(result.permission.bash).toEqual({
      "git status": "allow",
      "git diff": "allow",
    })
  })
})
