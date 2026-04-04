# Permission Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group similar permissions by command prefix to reduce config verbosity and improve maintainability.

**Architecture:** Add a `groupPermissions` function that extracts command groups (e.g., "git", "pnpm") from patterns and consolidates multiple permissions into single wildcard entries. Update `generateConfig` to use grouping with a configurable strategy.

**Tech Stack:** TypeScript, existing plugin infrastructure

---

### Task 1: Add Command Group Extraction

**Files:**
- Modify: `src/index.ts:59-70` (after extractPattern)

- [ ] **Step 1: Write the failing test**

Create test file `src/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest"

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL - extractCommandGroup not exported

- [ ] **Step 3: Write minimal implementation**

Add function after `extractPattern` in `src/index.ts`:

```typescript
function extractCommandGroup(pattern: string): string {
  const firstCommand = pattern.split(",")[0]?.trim() ?? pattern
  const parts = firstCommand.split(/\s+/)
  return parts[0] ?? "*"
}
```

Export it for testing at bottom of file:

```typescript
export { extractCommandGroup }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: add extractCommandGroup function"
```

---

### Task 2: Add Permission Grouping Function

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe("groupPermissions", () => {
  it("groups git commands under git:*", () => {
    const events = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
    ]
    expect(groupPermissions(events)).toEqual([
      { tool: "bash", pattern: "git:*", outcome: "granted" },
    ])
  })

  it("keeps single commands as-is", () => {
    const events = [
      { tool: "bash", pattern: "pnpm dev", outcome: "granted" },
    ]
    expect(groupPermissions(events)).toEqual(events)
  })

  it("preserves non-bash tools unchanged", () => {
    const events = [
      { tool: "edit", pattern: "file.ts", outcome: "granted" },
    ]
    expect(groupPermissions(events)).toEqual(events)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
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
      groups.set(groupKey, { tool: "bash", pattern: `${commandGroup}:*`, outcome: event.outcome })
    } else {
      groups.set(`${event.tool}:${event.pattern}`, event)
    }
  }

  return Array.from(groups.values())
}
```

Export: `export { extractCommandGroup, groupPermissions }`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: add groupPermissions function with excludeCommands"
```

---

### Task 3: Integrate Grouping into generateConfig

**Files:**
- Modify: `src/index.ts:72-83`

- [ ] **Step 1: Write the failing test**

```typescript
describe("generateConfig with grouping", () => {
  it("outputs grouped permissions", () => {
    const events = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
      { tool: "bash", pattern: "pnpm build", outcome: "granted" },
    ]
    const result = generateConfig(events) as { permission: Record<string, Record<string, string>> }
    expect(result.permission.bash).toEqual({
      "git:*": "allow",
      "pnpm:*": "allow",
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL - current output has individual commands

- [ ] **Step 3: Update implementation**

```typescript
function generateConfig(events: PermissionEvent[]): Record<string, unknown> {
  const grouped = groupPermissions(events)
  const permission: Record<string, Record<string, string>> = {}

  for (const event of grouped) {
    if (!permission[event.tool]) {
      permission[event.tool] = {}
    }
    permission[event.tool][event.pattern] = "allow"
  }

  return { permission }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: integrate grouping into generateConfig"
```

---

### Task 4: Add grouping threshold test

**Files:**
- Modify: `src/index.test.ts`

- [ ] **Step 1: Write the test**

```typescript
describe("groupPermissions threshold", () => {
  it("respects minimum threshold", () => {
    const events = [
      { tool: "bash", pattern: "git status", outcome: "granted" },
      { tool: "bash", pattern: "git diff", outcome: "granted" },
    ]
    expect(groupPermissions(events, { minGroupSize: 3 })).toEqual(events)
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm test`
Expected: PASS (already implemented)

- [ ] **Step 3: Commit**

```bash
git add src/index.test.ts
git commit -m "test: add threshold test for groupPermissions"
```

---

## Self-Review

**1. Spec coverage:**
- Grouping by command prefix ✓
- Handling comma-separated commands ✓
- Minimum threshold before grouping ✓
- Exclusion list for dangerous commands ✓
- Non-bash tools preserved ✓

**2. Placeholder scan:**
- No TBD, TODO, or placeholders
- All code blocks contain complete implementations

**3. Type consistency:**
- `PermissionEvent` interface used consistently
- `GroupOptions` interface defined before use
