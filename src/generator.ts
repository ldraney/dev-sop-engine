import { writeFileSync, mkdirSync, cpSync, existsSync, chmodSync, readdirSync } from 'fs';
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
  mkdirSync(join(claudeDir, 'hooks'), { recursive: true });
  mkdirSync(join(claudeDir, 'validators'), { recursive: true });
  mkdirSync(join(claudeDir, 'loggers'), { recursive: true });

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
      const dest = join(claudeDir, 'validators', file);
      cpSync(src, dest);
      chmodSync(dest, 0o755);
      output.push(`  validators/${file}`);
    }
  }

  // Copy loggers
  const loggersDir = join(sopSourceDir, 'loggers');
  if (existsSync(loggersDir)) {
    for (const file of readdirSync(loggersDir)) {
      const src = join(loggersDir, file);
      const dest = join(claudeDir, 'loggers', file);
      cpSync(src, dest);
      chmodSync(dest, 0o755);
      output.push(`  loggers/${file}`);
    }
  }

  // Copy sop.json (rule config)
  const sopConfigSrc = join(sopSourceDir, 'sop.json');
  if (existsSync(sopConfigSrc)) {
    cpSync(sopConfigSrc, join(claudeDir, 'sop.json'));
    output.push('  sop.json');
  }

  // Generate settings.json
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: "*",
          hooks: [
            {
              type: "command",
              command: "$CLAUDE_PROJECT_DIR/.claude/hooks/engine.sh"
            }
          ]
        }
      ]
    }
  };
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));
  output.push('  settings.json');

  output.push('\nDone. .claude/ is ready.');
  return output.join('\n');
}
