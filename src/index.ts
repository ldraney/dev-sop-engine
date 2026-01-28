#!/usr/bin/env node

import { generate } from './generator.js';

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
console.log(generate(targetDir));
