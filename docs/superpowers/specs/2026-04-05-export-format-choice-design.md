# Export Format Choice Design

## Summary

Add interactive prompt to `export-permissions` tool asking user whether they want combined (grouped) permissions or individual permissions when exporting.

## Motivation

Currently, `export-permissions` always groups bash commands by their command group (e.g., `git:*` for all git commands). Users may want the exact permissions they granted without consolidation for more precise control.

## Design

### User Flow

```
User runs export-permissions
        ↓
Tool asks: "Which format?"
  - Combined (git:* for multiple git commands)
  - Individual (each command separately)
        ↓
User selects option
        ↓
Tool generates config in chosen format
        ↓
Output result
```

### Implementation

**Question via SDK v2:**

The tool will use `@opencode-ai/sdk/v2` to ask the question:

1. Store pending question ID
2. Listen for `question.replied` event via `event.subscribe()`
3. When event arrives, match the ID and extract the answer
4. Generate config based on selection

**Modified `generateConfig` function:**

Add an optional parameter to skip grouping:

```typescript
function generateConfig(events: PermissionEvent[], skipGrouping?: boolean): Record<string, unknown>
```

When `skipGrouping` is true, bypass `groupPermissions()` and directly build the permission map.

### Code Changes

1. **src/index.ts:**
   - Import `OpencodeClient` from `@opencode-ai/sdk/v2`
   - Create client instance in tool execute function
   - Add question asking logic
   - Modify `generateConfig` to accept `skipGrouping` parameter

2. **Question definition:**
   ```typescript
   {
     question: "Which export format do you want?",
     header: "Format",
     options: [
       { label: "Combined", description: "Group related commands (e.g., git:* for all git commands)" },
       { label: "Individual", description: "Export each permission separately without grouping" }
     ]
   }
   ```

### Error Handling

- If question is rejected, output a message and exit
- If no permissions to export, return early before asking

### Testing

- Add unit test for `generateConfig` with `skipGrouping: true`
- Existing tests should continue to pass (default behavior unchanged)
