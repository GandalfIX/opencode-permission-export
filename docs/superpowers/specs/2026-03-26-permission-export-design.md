# OpenCode Permission Export Plugin - Design

## Summary

A plugin that tracks permission requests during an OpenCode session and exports granted permissions as a config snippet that can be pasted into `opencode.json`.

## Requirements

- Track all permission requests during a session
- Export on-demand via custom tool invocation
- Output to console for manual copy-paste
- Generate valid `permission` config syntax
- Include only granted permissions

## Architecture

```
opencode-permission-export/
├── package.json          # npm package definition
├── tsconfig.json         # TypeScript config  
├── src/
│   └── index.ts          # Plugin entry point
└── README.md             # Usage docs
```

## Components

### PermissionTracker

In-memory storage for permission events.

**Data structure:**
```typescript
interface PermissionEvent {
  tool: string           // e.g., "bash", "edit", "read"
  pattern: string        // e.g., "git status", "src/*.ts"
  outcome: 'granted' | 'denied'
}

class PermissionTracker {
  private events: PermissionEvent[] = []
  
  add(event: PermissionEvent): void
  getGranted(): PermissionEvent[]
  clear(): void
}
```

### Plugin Hooks

Subscribe to permission events:

```typescript
"permission.asked": (input, output) => {
  // input contains the permission request details
}

"permission.replied": (input, output) => {
  // output contains the user's response (allow/deny)
}
```

### Export Tool

Custom tool `export-permissions`:

```typescript
tool({
  description: "Export granted permissions as opencode config snippet",
  args: {},
  async execute(args, context) {
    // Generate config from tracker
    // Return formatted JSON
  }
})
```

## Data Flow

1. **During session**: Plugin hooks record each permission event to tracker
2. **User invokes**: "export permissions" or "export my permissions"
3. **Tool executes**: Filters granted permissions, generates config
4. **Output**: Formatted JSON printed to console

## Output Format

```json
{
  "permission": {
    "bash": {
      "git status": "allow",
      "npm run *": "allow"
    },
    "edit": {
      "src/*.ts": "allow"
    }
  }
}
```

## Error Handling

| Scenario | Response |
|----------|----------|
| No permissions collected | "No permissions have been asked this session." |
| All permissions denied | "No permissions were granted. All requests were denied." |
| Mixed results | Export granted only, note denied count in message |

## Implementation Notes

- Pattern extraction: The permission system provides patterns in the event data. Use those directly.
- Grouping: Group by tool name for cleaner output structure.
- Deduplication: Same tool+pattern combinations should appear once.
