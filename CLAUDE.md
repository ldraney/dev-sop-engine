# dev-sop-engine

CLI that generates `.claude/` and `.mcp.json` from `sop.json`.

## What This Does

Users define their Claude configuration in `sop.json`. This tool generates the complete `.claude/` directory structure.

```bash
npx dev-sop-engine init        # Create starter sop.json + sop/ scaffold
npx dev-sop-engine .           # Generate .claude/ and .mcp.json from sop.json
```

## Architecture

```
dev-sop-engine/                    # This repo
├── CLAUDE.md
├── package.json
├── src/
│   ├── index.ts                   # CLI entry
│   ├── generator/
│   │   ├── index.ts               # Main generate logic
│   │   ├── settings.ts            # Generates settings.json
│   │   ├── skills.ts              # Generates skills/
│   │   ├── agents.ts              # Generates agents/
│   │   ├── hooks.ts               # Copies hooks
│   │   └── mcp.ts                 # Generates .mcp.json
│   └── schema/
│       └── sop.schema.json        # JSON Schema for validation
│
├── sop.json                       # Dogfood: our own config
├── sop/                           # Dogfood: our source files
│   └── ...
│
└── .claude/                       # Generated output (dogfood)
```

## sop.json Schema

```jsonc
{
  "$schema": "./node_modules/dev-sop-engine/sop.schema.json",
  "version": "1.0.0",

  "memory": {
    "project_file": "./sop/CLAUDE.md"
  },

  "settings": {
    "env": { "NODE_ENV": "development" },
    "permissions": {
      "allow": ["Bash(npm run *)"],
      "deny": ["Read(.env)"]
    },
    "hooks": {
      "PostToolUse": {
        "Write|Edit": ["./sop/hooks/lint.sh"]
      }
    }
  },

  "mcp": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  },

  "skills": {
    "workflow": {
      "description": "Project workflow",
      "content_file": "./sop/skills/workflow.md"
    }
  },

  "agents": {
    "reviewer": {
      "description": "Code review specialist",
      "model": "sonnet",
      "tools": ["Read", "Grep", "Glob"],
      "prompt_file": "./sop/agents/reviewer.md"
    }
  }
}
```

## Source vs Generated

```
project/
├── sop.json                       # Source of truth
├── sop/                           # Your source files
│   ├── CLAUDE.md
│   ├── hooks/
│   │   └── lint.sh
│   └── skills/
│       └── workflow.md
│
├── .claude/                       # GENERATED (portable, self-contained)
│   ├── settings.json
│   ├── CLAUDE.md                  # Copied
│   ├── hooks/
│   │   └── lint.sh                # Copied
│   └── skills/
│       └── workflow/
│           └── SKILL.md           # Copied
│
└── .mcp.json                      # GENERATED
```

## Development

```bash
npm install
npm run build
npm run dev                        # Watch mode
```
