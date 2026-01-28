# dev-sop-engine

CLI and MCP server that generates `.claude/` and `.mcp.json` from `sop.json`.

## What This Does

Users define their Claude Code configuration in `sop.json`. This tool generates the complete `.claude/` directory structure and `.mcp.json`.

```bash
npx dev-sop-engine .           # Generate .claude/ and .mcp.json from sop.json
```

**Not yet implemented:**
- `npx dev-sop-engine init` — scaffold starter sop.json + sop/ (planned)
- `npx dev-sop-engine validate` — validate sop.json (planned)

## Architecture

```
dev-sop-engine/                    # This repo
├── CLAUDE.md
├── package.json
├── src/
│   ├── index.ts                   # CLI entry point
│   ├── generator.ts               # All generation logic (~280 lines)
│   └── mcp-server.ts              # MCP server mode (~85 lines)
│
├── sop/                           # Dogfood: our own config
│   ├── sop.json                   # Our sop.json
│   ├── validators/                # Hook validator scripts
│   ├── loggers/                   # Hook logging scripts
│   ├── skills/                    # Skill content files
│   ├── agents/                    # Agent prompt files
│   └── hooks/                     # Hook entry point (engine.sh)
│
├── .claude/                       # Generated output (dogfood)
│   ├── settings.json
│   ├── hooks/
│   ├── skills/
│   └── agents/
│
├── .mcp.json                      # Generated MCP config
│
└── docs/                          # GitHub Pages site
```

## sop.json Schema

```jsonc
{
  "version": "1.0",
  "enforcement": "hard",  // "hard" blocks on violations, "soft" warns only

  // Rules: validators that run on hook events
  "rules": {
    "<rule-name>": {
      "description": "What this rule enforces",
      "events": ["PreToolUse"],           // Hook events to trigger on
      "matcher": "Write|Edit",            // Tool name regex (for tool events)
      "condition": "optional-regex",      // Additional input filtering
      "validator": "validators/script.sh", // Script to run
      "enabled": true
    }
  },

  // Logging: event logging configuration
  "logging": {
    "enabled": true,
    "stderr": true,                       // Also log to stderr
    "file": "~/.claude/logs/hooks.jsonl", // Log file path
    "events": ["PreToolUse", "Stop"],     // Which events to log
    "include_blocked_only": false,        // Only log blocked actions
    "handler": "loggers/log-event.sh"     // Custom log handler
  },

  // Subagents: inheritance settings
  "subagents": {
    "inherit_rules": true                 // Apply rules to Task agents
  },

  // MCP: Model Context Protocol servers
  "mcp": {
    "<server-name>": {
      "command": "npx",
      "args": ["-y", "@scope/package"],
      "env": { "TOKEN": "${TOKEN}" }
    }
  },

  // Skills: reusable context files invoked with /<name>
  "skills": {
    "<skill-name>": {
      "description": "What this skill provides",
      "content_file": "./skills/<name>.md"
    }
  },

  // Agents: specialized sub-agents for Task tool
  "agents": {
    "<agent-name>": {
      "description": "What this agent does",      // Required: shown in Task tool
      "prompt_file": "./agents/<name>.md",        // Required: agent instructions
      "tools": ["Read", "Glob", "Grep"],          // Optional: tool allowlist
      "model": "sonnet"                           // Optional: sonnet|opus|haiku
    }
  }
}
```

## Claude Code Hook Events

| Hook | When it fires | Matcher support |
|------|---------------|-----------------|
| `PreToolUse` | Before any tool runs | Yes |
| `PostToolUse` | After tool succeeds | Yes |
| `PostToolUseFailure` | After tool fails | Yes |
| `UserPromptSubmit` | User sends a message | No |
| `Stop` | Claude finishes responding | No |
| `SessionStart` | Session begins | No |
| `SessionEnd` | Session terminates | No |
| `SubagentStart` | Task agent spawns | No |
| `SubagentStop` | Task agent finishes | No |
| `PreCompact` | Before context compaction | No |
| `Notification` | Status messages | No |

### Hook Input/Output

Hooks receive JSON via stdin:

```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file", "content": "..." },
  "cwd": "/current/working/directory"
}
```

Exit codes:
- `0` - Success, allow action
- `2` - Block action, show stderr to Claude
- Other - Non-blocking error, continue

### Tool Names for Matchers

Common tools to match:
- `Write`, `Edit`, `Read` - File operations
- `Bash` - Shell commands
- `Glob`, `Grep` - Search
- `Task` - Subagent tasks
- `WebFetch`, `WebSearch` - Web access
- `mcp__<server>__<tool>` - MCP tools

Matcher syntax: `"Write|Edit"` (regex), `"Bash"` (exact), `"*"` (all)

## Source vs Generated

```
project/
├── sop/                           # Source of truth (edit these)
│   ├── sop.json                   # Configuration
│   ├── validators/                # Rule scripts
│   ├── loggers/                   # Log handler scripts
│   ├── hooks/                     # Hook entry point
│   ├── skills/                    # Skill markdown files
│   └── agents/                    # Agent prompt files
│
├── .claude/                       # GENERATED (portable, self-contained)
│   ├── settings.json
│   ├── sop.json                   # Copied for runtime reference
│   ├── hooks/
│   │   ├── engine.sh              # Hook router
│   │   ├── validators/            # Copied
│   │   └── loggers/               # Copied
│   ├── skills/
│   │   └── <name>/SKILL.md        # Copied
│   └── agents/
│       └── <name>.md              # With YAML frontmatter
│
└── .mcp.json                      # GENERATED (merged with manual entries)
```

## MCP Server Mode

The engine also runs as an MCP server, exposing `sop_generate` as a tool.
This means any Claude Code session can generate `.claude/` for a target directory.

## Current Status

**Implemented:** Generator (rules, logging, skills, agents, MCP merge), CLI, MCP server, dogfooding.

**Not yet implemented:** `init` command, `validate` command, JSON Schema file, tests, CI, npm publishing.

## Development

```bash
npm install
npm run build
npm run dev                        # Watch mode
```
