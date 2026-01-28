import { writeFileSync, mkdirSync, cpSync, existsSync, chmodSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getEngineDir(): string {
  return join(__dirname, '..');
}

export function generate(targetDir: string): string {
  const engineDir = getEngineDir();
  const sopSourceDir = join(engineDir, 'sop');
  const claudeDir = join(targetDir, '.claude');

  const output: string[] = [];
  output.push(`Generating .claude/ in ${targetDir}`);

  // Create .claude directory structure
  mkdirSync(join(claudeDir, 'hooks', 'validators'), { recursive: true });
  mkdirSync(join(claudeDir, 'hooks', 'loggers'), { recursive: true });

  // Copy engine.sh
  const engineSrc = join(sopSourceDir, 'hooks', 'engine.sh');
  const engineDest = join(claudeDir, 'hooks', 'engine.sh');
  cpSync(engineSrc, engineDest);
  chmodSync(engineDest, 0o755);
  output.push('  hooks/engine.sh');

  // Copy validators
  const validatorsDir = join(sopSourceDir, 'validators');
  if (existsSync(validatorsDir)) {
    for (const file of readdirSync(validatorsDir)) {
      const src = join(validatorsDir, file);
      const dest = join(claudeDir, 'hooks', 'validators', file);
      cpSync(src, dest);
      chmodSync(dest, 0o755);
      output.push(`  hooks/validators/${file}`);
    }
  }

  // Copy loggers
  const loggersDir = join(sopSourceDir, 'loggers');
  if (existsSync(loggersDir)) {
    for (const file of readdirSync(loggersDir)) {
      const src = join(loggersDir, file);
      const dest = join(claudeDir, 'hooks', 'loggers', file);
      cpSync(src, dest);
      chmodSync(dest, 0o755);
      output.push(`  hooks/loggers/${file}`);
    }
  }

  // Copy sop.json (rule config)
  const sopConfigSrc = join(sopSourceDir, 'sop.json');
  if (existsSync(sopConfigSrc)) {
    cpSync(sopConfigSrc, join(claudeDir, 'sop.json'));
    output.push('  sop.json');
  }

  // Load sop.json for skills/agents config
  const sopConfigPath = join(sopSourceDir, 'sop.json');
  const sopConfig = existsSync(sopConfigPath)
    ? JSON.parse(readFileSync(sopConfigPath, 'utf-8'))
    : {};

  // Copy skills
  if (sopConfig.skills) {
    for (const [name, skill] of Object.entries(sopConfig.skills as Record<string, { content_file: string }>)) {
      const skillDir = join(claudeDir, 'skills', name);
      mkdirSync(skillDir, { recursive: true });
      const srcPath = join(sopSourceDir, skill.content_file);
      if (existsSync(srcPath)) {
        cpSync(srcPath, join(skillDir, 'SKILL.md'));
        output.push(`  skills/${name}/SKILL.md`);
      }
    }
  }

  // Copy agents with YAML frontmatter injection
  if (sopConfig.agents) {
    mkdirSync(join(claudeDir, 'agents'), { recursive: true });

    interface AgentConfig {
      description: string;
      prompt_file: string;
      tools?: string[];
      model?: string;
    }

    for (const [name, agent] of Object.entries(sopConfig.agents as Record<string, AgentConfig>)) {
      const srcPath = join(sopSourceDir, agent.prompt_file);
      if (existsSync(srcPath)) {
        const content = readFileSync(srcPath, 'utf-8');

        // Build YAML frontmatter (quote values to handle special chars like colons)
        const frontmatter: string[] = ['---', `name: "${name}"`, `description: "${agent.description}"`];
        if (agent.tools && agent.tools.length > 0) {
          frontmatter.push(`tools: ${agent.tools.join(', ')}`);
        }
        if (agent.model) {
          frontmatter.push(`model: ${agent.model}`);
        }
        frontmatter.push('---', '');

        // Write agent file with frontmatter prepended
        const outputContent = frontmatter.join('\n') + content;
        writeFileSync(join(claudeDir, 'agents', `${name}.md`), outputContent);
        output.push(`  agents/${name}.md`);
      }
    }
  }

  // Generate settings.json with all hook events
  const allEvents = [
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "UserPromptSubmit",
    "Stop",
    "SessionStart",
    "SessionEnd",
    "SubagentStart",
    "SubagentStop",
    "PreCompact",
    "Notification"
  ];

  const hookConfig = {
    matcher: "*",
    hooks: [
      {
        type: "command",
        command: "$CLAUDE_PROJECT_DIR/.claude/hooks/engine.sh"
      }
    ]
  };

  const settings: { hooks: Record<string, typeof hookConfig[]> } = { hooks: {} };
  for (const event of allEvents) {
    settings.hooks[event] = [hookConfig];
  }
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));
  output.push('  settings.json');

  output.push('\nDone. .claude/ is ready.');
  return output.join('\n');
}
