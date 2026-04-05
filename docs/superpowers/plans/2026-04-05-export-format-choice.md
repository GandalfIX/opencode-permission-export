# Export Format Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add format argument to export-permissions tool allowing user to choose combined or individual permissions.

**Architecture:** Add optional `format` argument to the tool. When "individual", pass `skipGrouping=true` to `generateConfig`. Default to "combined" for backwards compatibility.

**Tech Stack:** TypeScript, vitest

---

### Task 1: Add skipGrouping parameter to generateConfig

**Files:**
- Modify: `src/index.ts:119-131`
- Test: `src/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/index.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - skipGrouping parameter not supported

- [ ] **Step 3: Modify generateConfig to accept skipGrouping parameter**

Change `src/index.ts` line 119:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "feat: add skipGrouping parameter to generateConfig"
```

---

### Task 2: Add format argument to export-permissions tool

**Files:**
- Modify: `src/index.ts:152-174`

- [ ] **Step 1: Import z from zod and add format argument schema**

The `tool` function already has `tool.schema` available. Modify the tool definition at line 152:

```typescript
tool({
  description: "Export granted permissions as opencode config snippet. Paste the output into your opencode.json.",
  args: {
    format: tool.schema.enum(["combined", "individual"]).optional().default("combined").describe("Export format: 'combined' groups related commands (e.g., git:*), 'individual' exports each permission separately")
  },
  async execute(args, context) {
    if (!tracker.hasEvents()) {
      return "No permissions have been asked this session."
    }

    const granted = tracker.getGranted()
    if (granted.length === 0) {
      const denied = tracker.getDenied()
      return `No permissions were granted. ${denied.length} request(s) were denied.`
    }

    const skipGrouping = args.format === "individual"
    const config = generateConfig(granted, skipGrouping)
    const denied = tracker.getDenied()
    const deniedNote = denied.length > 0 ? `\n\nNote: ${denied.length} permission(s) were denied and not included.` : ""

    const formatLabel = skipGrouping ? "individual" : "combined"
    return `Copy this into your opencode.json (${formatLabel} format):\n\n${JSON.stringify(config, null, 2)}${deniedNote}`
  },
})
```

- [ ] **Step 2: Run typecheck**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add format argument to export-permissions tool"
```

---

### Task 3: Final verification

**Files:**
- None

- [ ] **Step 1: Run full build and test suite**

Run: `npm run build && npm test`
Expected: All pass

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: verify build and tests pass"
```
