# Export "Always" Permissions Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an option to the export-permissions tool to only export permissions that were granted with "always" (not "once").

**Architecture:** Extend the PermissionEvent interface to track the reply type ("once" or "always"), add a filter parameter to the export tool, and update the config generation to optionally filter by reply type.

**Tech Stack:** TypeScript, @opencode-ai/plugin

---

## File Structure

- Modify: `src/index.ts` - Update PermissionEvent interface, tracker logic, and export tool

---

### Task 1: Update PermissionEvent to track reply type

**Files:**
- Modify: `src/index.ts:12-16`

- [ ] **Step 1: Update PermissionEvent interface**

Change the interface to include a `replyType` field:

```typescript
interface PermissionEvent {
  tool: string
  pattern: string
  outcome: "granted" | "denied"
  replyType: "once" | "always"
}
```

- [ ] **Step 2: Update PermissionTracker.add to handle replyType**

Modify the `add` method signature and deduplication logic:

```typescript
add(event: PermissionEvent): void {
  const exists = this.events.some(
    (e) => e.tool === event.tool && e.pattern === event.pattern && e.outcome === event.outcome && e.replyType === event.replyType
  )
  if (!exists) {
    this.events.push(event)
  }
}
```

- [ ] **Step 3: Add getAlways method to PermissionTracker**

Add a new method to filter only "always" permissions:

```typescript
getAlways(): PermissionEvent[] {
  return this.events.filter((e) => e.outcome === "granted" && e.replyType === "always")
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 2: Update event tracking to capture reply type

**Files:**
- Modify: `src/index.ts:151-159`

- [ ] **Step 1: Pass reply type to tracker.add**

Update the permission.replied handler:

```typescript
if (event.type === "permission.replied") {
  const props = event.properties as { requestID: string; reply: string }
  const permission = tracker.getPermission(props.requestID)
  if (permission && (props.reply === "once" || props.reply === "always")) {
    const tool = permission.type
    const pattern = extractPattern(permission)
    tracker.add({ tool, pattern, outcome: "granted", replyType: props.reply as "once" | "always" })
  }
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 3: Add filter option to export-permissions tool

**Files:**
- Modify: `src/index.ts:163-191`

- [ ] **Step 1: Add filter parameter to tool args**

Update the args schema:

```typescript
args: {
  format: tool.schema.enum(["combined", "individual"]).optional().default("combined").describe("Export format: 'combined' groups related commands (e.g., git:*), 'individual' exports each permission separately"),
  filter: tool.schema.enum(["all", "always"]).optional().default("all").describe("Filter permissions: 'all' includes all granted permissions, 'always' only includes permissions granted with 'always'")
}
```

- [ ] **Step 2: Update execute function to apply filter**

Modify the execute function:

```typescript
async execute(args, context) {
  if (!tracker.hasEvents()) {
    return "No permissions have been asked this session."
  }

  const granted = args.filter === "always" ? tracker.getAlways() : tracker.getGranted()
  if (granted.length === 0) {
    const filterNote = args.filter === "always" ? "always-" : ""
    const denied = tracker.getDenied()
    return `No permissions were granted with "${filterNote}always". ${denied.length} request(s) were denied.`
  }

  const denied = tracker.getDenied()
  const deniedNote = denied.length > 0 ? `\n\nNote: ${denied.length} permission(s) were denied and not included.` : ""
  const filterNote = args.filter === "always" ? " (always only)" : ""

  if (args.format === "individual") {
    const configs = generateIndividualConfigs(granted)
    const output = configs.map(c => JSON.stringify(c)).join("\n")
    return `Copy these into your opencode.json (individual format${filterNote}):\n\n${output}${deniedNote}`
  }

  const config = generateConfig(granted, false)
  return `Copy this into your opencode.json (combined format${filterNote}):\n\n${JSON.stringify(config, null, 2)}${deniedNote}`
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 4: Update exports and test

**Files:**
- Modify: `src/index.ts:198-199`

- [ ] **Step 1: Update exports to include new type**

Ensure PermissionEvent export includes the updated interface (already exported at line 199).

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add filter option to export only 'always' permissions"
```
