# Permission Export Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenCode plugin that tracks granted permissions during a session and exports them as a config snippet.

**Architecture:** Plugin hooks into `permission.asked` and `permission.replied` events to track requests. A custom `export-permissions` tool generates JSON config from collected grants.

**Tech Stack:** TypeScript, @opencode-ai/plugin types, Bun runtime

---

## File Structure

```
opencode-permission-export/
├── package.json        # npm package definition
├── tsconfig.json       # TypeScript configuration
├── src/
│   └── index.ts        # Plugin entry point with tracker and tool
└── README.md           # Usage documentation
```

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "opencode-permission-export",
  "version": "1.0.0",
  "description": "OpenCode plugin to export granted permissions as config snippet",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": ">=1.0.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "latest",
    "typescript": "^5.0.0"
  },
  "keywords": ["opencode", "plugin", "permissions"],
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `bun install`
Expected: Dependencies installed successfully

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json bun.lock
git commit -m "chore: initialize project with package.json and tsconfig"
```

---

### Task 2: Create Plugin Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create the plugin with PermissionTracker and hooks**

```typescript
import type { Plugin } from "@opencode-ai/plugin"

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
    "permission.asked": async (input, _output) => {
      const tool = input.tool ?? "unknown"
      const pattern = extractPattern(input)
      tracker.add({ tool, pattern, outcome: "denied" })
    },

    "permission.replied": async (input, output) => {
      const tool = input.tool ?? "unknown"
      const pattern = extractPattern(input)
      const outcome = output.response === "allow" ? "granted" : "denied"
      tracker.add({ tool, pattern, outcome })
    },
  }
}

function extractPattern(input: Record<string, unknown>): string {
  if (typeof input.pattern === "string") return input.pattern
  if (typeof input.command === "string") return input.command
  if (typeof input.filePath === "string") return input.filePath
  if (typeof input.path === "string") return input.path
  if (typeof input.url === "string") return input.url
  if (typeof input.query === "string") return input.query
  return "*"
}

export default PermissionExportPlugin
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add permission tracking hooks"
```

---

### Task 3: Add Export Tool

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import tool helper and add tool to plugin**

Replace the entire `src/index.ts` with:

```typescript
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

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

function extractPattern(input: Record<string, unknown>): string {
  if (typeof input.pattern === "string") return input.pattern
  if (typeof input.command === "string") return input.command
  if (typeof input.filePath === "string") return input.filePath
  if (typeof input.path === "string") return input.path
  if (typeof input.url === "string") return input.url
  if (typeof input.query === "string") return input.query
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
    "permission.asked": async (input, _output) => {
      const tool = input.tool ?? "unknown"
      const pattern = extractPattern(input)
      tracker.add({ tool, pattern, outcome: "denied" })
    },

    "permission.replied": async (input, output) => {
      const tool = input.tool ?? "unknown"
      const pattern = extractPattern(input)
      const outcome = output.response === "allow" ? "granted" : "denied"
      tracker.add({ tool, pattern, outcome })
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
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add export-permissions tool"
```

---

### Task 4: Build and Verify

**Files:**
- None (build artifacts in `dist/`)

- [ ] **Step 1: Build the plugin**

Run: `bun run build`
Expected: TypeScript compiles without errors, `dist/index.js` and `dist/index.d.ts` created

- [ ] **Step 2: Verify output exists**

Run: `ls -la dist/`
Expected: `index.js` and `index.d.ts` files present

- [ ] **Step 3: Commit**

```bash
git add dist/
git commit -m "build: compile TypeScript to dist"
```

---

### Task 5: Add README Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# opencode-permission-export

OpenCode plugin that exports granted permissions as a config snippet.

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-permission-export"]
}
```

Or for local development:

```json
{
  "plugin": ["/path/to/opencode-permission-export"]
}
```

## Usage

During an OpenCode session, the plugin tracks all permission requests. When you want to export the granted permissions:

```
export my permissions
```

or

```
run export-permissions
```

The tool outputs a JSON snippet you can copy into your `opencode.json`:

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

## How It Works

1. Hooks into `permission.asked` and `permission.replied` events
2. Tracks which permissions were granted vs denied
3. Generates valid OpenCode permission config syntax
4. Only exports granted permissions (denied are noted but not included)

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

---

### Task 6: Add .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
dist/
*.log
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```

---

## Self-Review

**Spec coverage:**
- ✅ Track all permission requests → Task 2 (hooks)
- ✅ Export on-demand via custom tool → Task 3 (export-permissions tool)
- ✅ Output to console → Task 3 (tool returns string)
- ✅ Generate valid permission config → Task 3 (generateConfig function)
- ✅ Include only granted permissions → Task 3 (filters by outcome)

**Placeholder scan:** No TBD, TODO, or incomplete sections.

**Type consistency:** `PermissionEvent` interface used consistently. `tool`, `pattern`, `outcome` properties match across all functions.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-26-permission-export.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
