# Architecture

## Overview

This plugin tracks permission requests during an OpenCode session and exports them as a reusable config snippet.

## Components

### PermissionTracker (src/index.ts:11-48)

Central state manager that:
- Stores pending permission requests (awaiting user response)
- Records granted/denied outcomes
- Deduplicates events (same tool + pattern + outcome)
- Provides filtered access to granted vs denied permissions

### Event Hooks

The plugin registers two hooks:

1. **`permission.ask`** (src/index.ts:80-86) - Fires when permission is requested
   - Stores the permission in pending map
   - If auto-allowed (status === "allow"), records immediately

2. **`event`** (src/index.ts:89-98) - Fires on all events
   - Filters for `permission.replied` events
   - Matches response to stored permission via ID
   - Records granted permissions

### Tool: export-permissions (src/index.ts:102-122)

User-invoked tool that:
- Checks for tracked events
- Generates JSON config via `generateConfig()`
- Outputs formatted snippet with denied count note

### Pattern Extraction (src/index.ts:52-63)

Extracts the permission pattern from various metadata fields:
- `pattern` (array or string)
- `metadata.command` (bash commands)
- `metadata.filePath` (edit/read operations)
- `metadata.path` (glob operations)
- `metadata.url` (webfetch)
- `metadata.query` (grep)
- Falls back to `"*"` if none found

### Config Generation (src/index.ts:65-76)

Transforms permission events into nested config structure:

```
events [{tool: "bash", pattern: "git status", outcome: "granted"}]
    ↓
{permission: {bash: {"git status": "allow"}}}
```

## Data Flow

```
User action requiring permission
        ↓
OpenCode fires permission.ask
        ↓
Plugin stores permission, checks if auto-allowed
        ↓
User responds (allow/deny)
        ↓
OpenCode fires permission.replied event
        ↓
Plugin matches ID, records outcome
        ↓
User runs export-permissions tool
        ↓
Plugin outputs config snippet
```
