#!/usr/bin/env node

import { writeFileSync, mkdirSync, cpSync, existsSync, chmodSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getEngineDir(): string {
  // When running from dist/, go up one level to find sop/
  return join(__dirname, '..');
}

function generate(targetDir: string) {
  const engineDir = getEngineDir();
  const sopSourceDir = join(engineDir, 'sop');
  const claudeDir = join(targetDir, '.claude');

  console.log(`Generating .claude/ in ${targetDir}`);

  // Create .claude directory structure
  mkdirSync(join(claudeDir, 'hooks'), { recursive: true });
  mkdirSync(join(claudeDir, 'validators'), { recursive: true });
  mkdirSync(join(claudeDir, 'loggers'), { recursive: true });

  // Copy engine.sh
  const engineSrc = join(sopSourceDir, 'hooks', 'engine.sh');
  const engineDest = join(claudeDir, 'hooks', 'engine.sh');
  cpSync(engineSrc, engineDest);
  chmodSync(engineDest, 0o755);
  console.log('  hooks/engine.sh');

  // Copy validators
  const validatorsDir = join(sopSourceDir, 'validators');
  if (existsSync(validatorsDir)) {
    for (const file of readdirSync(validatorsDir)) {
      const src = join(validatorsDir, file);
      const dest = join(claudeDir, 'validators', file);
      cpSync(src, dest);
      chmodSync(dest, 0o755);
      console.log(`  validators/${file}`);
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
      console.log(`  loggers/${file}`);
    }
  }

  // Copy sop.json (rule config)
  const sopConfigSrc = join(sopSourceDir, 'sop.json');
  if (existsSync(sopConfigSrc)) {
    cpSync(sopConfigSrc, join(claudeDir, 'sop.json'));
    console.log('  sop.json');
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
  console.log('  settings.json');

  console.log('\nDone. .claude/ is ready.');
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
dev-sop-engine - Generate .claude/ directory

Usage:
  npx dev-sop-engine [target-dir]

Examples:
  npx dev-sop-engine .              # Generate in current directory
  npx dev-sop-engine ~/my-project   # Generate in specified directory

The generated .claude/ includes:
  - hooks/engine.sh     Route events to validators
  - validators/         Rule enforcement scripts
  - loggers/            Event logging
  - sop.json            Rule configuration
  - settings.json       Claude Code hook config
`);
  process.exit(0);
}

const targetDir = args[0] || process.cwd();
generate(targetDir);
