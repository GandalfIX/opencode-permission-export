# opencode-permission-export

OpenCode plugin that exports granted permissions as a config snippet.

## Installation

```bash
npm install @gandalfix/opencode-permission-export
```

Add to your `opencode.json`:

```json
{
  "plugin": ["@gandalfix/opencode-permission-export"]
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

1. Hooks into `permission.ask` and `permission.replied` events
2. Tracks which permissions were granted vs denied
3. Generates valid OpenCode permission config syntax
4. Only exports granted permissions (denied are noted but not included)

## License

MIT
