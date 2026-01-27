# dev-sop-engine

MCP server that generates `.claude/` directory from `sop.json`.

## What This Does

Users define their process rules in `sop.json`. This tool generates the `.claude/` hook infrastructure.

```bash
npx dev-sop-engine generate   # Generate .claude/ from sop.json
npx dev-sop-engine status     # Check if .claude/ matches sop.json
```

## Architecture

```
dev-sop-engine/
├── src/
│   ├── index.ts              # MCP server entry (stdio)
│   ├── cli.ts                # CLI entry
│   └── generator/            # Generation logic
├── templates/                # Shell scripts copied to .claude/
│   ├── engine.sh             # Routes events to validators
│   ├── validators/           # Rule implementations
│   └── loggers/              # Logging scripts
└── package.json
```

## How Rules Work

1. **This repo** ships validator templates in `templates/validators/`
2. **Users** create `sop.json` with `enabled: true/false` for each rule
3. **Generator** copies enabled validators to `.claude/`
4. **engine.sh** reads `sop.json` at runtime and routes to validators

## Adding a New Rule

1. Create `templates/validators/my-rule.sh`
2. Document the rule schema
3. Open PR

## MCP Tools

- `sop_generate` - Create/update .claude/ from sop.json
- `sop_status` - Check sync status via hash comparison
