# dev-sop-engine (ARCHIVED)

## Status: Archived

This project has been archived. The approach it took — generating `.claude/` from a separate `sop/` source directory — turned out to be unnecessary indirection.

## What We Learned

The generator solved the wrong problem. After using it to onboard a real project (thoughts-and-posts), the friction was clear:

1. **sop/ -> .claude/ is pointless indirection.** You write the same files either way — markdown agents, markdown skills, JSON settings, shell scripts. The generator just copies them with minor transformations (YAML frontmatter injection, directory restructuring). That's not worth a build step.

2. **engine.sh routing everything through sop.json rules is overengineered.** A SessionStart hook that loads an agent profile is one line: `cat $CLAUDE_PROJECT_DIR/.claude/agents/my-agent.md`. Routing it through engine.sh -> sop.json -> validator is three layers of abstraction for a `cat` command.

3. **.claude/ should be tracked in git, not generated.** It's project configuration — the same as `.github/` or `.vscode/`. Each repo should own its `.claude/` directly, version-control it, and customize it to its needs. Only `.claude/projects/` and `.claude/todos/` (session-specific data) should be gitignored.

4. **What actually helps is knowing the anatomy.** The real value is a clear SOP that teaches: what goes in settings.json, how to write agent profiles with YAML frontmatter, how skills work, how hooks receive JSON and communicate through exit codes. Once you know the anatomy, you don't need a generator.

## What Replaced This

- **SOP-9: Claude Code Project Setup** in Notion — a comprehensive SOP covering the full `.claude/` directory anatomy, what to git-track vs gitignore, and a setup checklist for new repos.
- Each repo gets its own hand-crafted `.claude/` directory, tracked in git.

## Reference .gitignore for Claude Code Projects

```gitignore
# Claude Code session data (auto-created, not config)
.claude/projects/
.claude/todos/

# Worktrees
.worktrees/

# Standard
node_modules/
.env
.env.*
```

## .claude/ Directory Anatomy (Quick Reference)

```
.claude/
├── settings.json        # Hook configuration
├── agents/              # Agent profiles (YAML frontmatter + markdown)
│   └── my-agent.md
├── skills/              # Slash-command skills
│   └── my-skill/
│       └── SKILL.md
└── hooks/               # Hook scripts (optional)
    └── my-hook.sh

Project root:
├── .mcp.json            # MCP server configuration
└── CLAUDE.md            # Project instructions (loaded every session)
```

## Historical Documentation

The original sop.json schema, hook event reference, and engine.sh architecture are preserved in the git history for reference.
