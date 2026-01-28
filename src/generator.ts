import { writeFileSync, mkdirSync, cpSync, existsSync, chmodSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpJsonFile {
  _managedBy?: string;
  _managedServers?: string[];
  mcpServers?: Record<string, McpServerConfig>;
}

/**
 * Merge MCP server configurations with tracking of managed servers.
 * - Servers in sop.json mcp section are "managed" by dev-sop-engine
 * - Existing servers not in _managedServers are "manual" and preserved
 * - Returns the merged config with updated tracking
 */
function mergeMcpConfig(
  existingConfig: McpJsonFile | null,
  sopMcpServers: Record<string, McpServerConfig>
): McpJsonFile {
  const sopServerNames = Object.keys(sopMcpServers);

  // If no existing config, just create new one with all servers as managed
  if (!existingConfig) {
    return {
      _managedBy: 'dev-sop-engine',
      _managedServers: sopServerNames,
      mcpServers: sopMcpServers,
    };
  }

  const existingServers = existingConfig.mcpServers || {};
  const previouslyManaged = existingConfig._managedServers || [];

  // Identify manual servers (exist but were never managed by us)
  const manualServers: Record<string, McpServerConfig> = {};
  for (const [name, config] of Object.entries(existingServers)) {
    if (!previouslyManaged.includes(name)) {
      manualServers[name] = config;
    }
  }

  // Merge: manual servers + new managed servers from sop.json
  const mergedServers: Record<string, McpServerConfig> = {
    ...manualServers,
    ...sopMcpServers,
  };

  return {
    _managedBy: 'dev-sop-engine',
    _managedServers: sopServerNames,
    mcpServers: mergedServers,
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function getEngineDir(): string {
  return join(__dirname, '..');
}

export function generate(targetDir: string): string {
  const engineDir = getEngineDir();
  const claudeDir = join(targetDir, '.claude');
  const output: string[] = [];

  // Determine sop source: prefer target's sop/, fall back to engine's defaults
  const targetSopDir = join(targetDir, 'sop');
  const engineSopDir = join(engineDir, 'sop');
  const sopSourceDir = existsSync(targetSopDir) ? targetSopDir : engineSopDir;
  const usingDefaults = sopSourceDir === engineSopDir;

  // Load sop.json for config
  const sopConfigPath = join(sopSourceDir, 'sop.json');
  const sopConfig = existsSync(sopConfigPath)
    ? JSON.parse(readFileSync(sopConfigPath, 'utf-8'))
    : {};

  // Check if .claude/ already exists
  const claudeExists = existsSync(claudeDir);

  if (claudeExists) {
    // .claude/ exists - only update .mcp.json
    output.push(`Found existing .claude/ in ${targetDir}`);
    output.push('  Skipping .claude/ generation (use sop-expert agent for changes)');
  } else {
    // No .claude/ - generate from sop source
    if (usingDefaults) {
      output.push(`Generating .claude/ in ${targetDir} (using defaults)`);
    } else {
      output.push(`Generating .claude/ in ${targetDir} (from sop/)`);
    }

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
  }

  // .mcp.json merge logic - only if target has its own sop/sop.json with mcp section
  // (don't apply engine defaults to .mcp.json - that's project-specific)
  const targetSopConfig = existsSync(join(targetDir, 'sop', 'sop.json'))
    ? JSON.parse(readFileSync(join(targetDir, 'sop', 'sop.json'), 'utf-8'))
    : null;

  if (targetSopConfig?.mcp && Object.keys(targetSopConfig.mcp).length > 0) {
    const mcpJsonPath = join(targetDir, '.mcp.json');

    // Read existing .mcp.json if it exists
    let existingMcpConfig: McpJsonFile | null = null;
    if (existsSync(mcpJsonPath)) {
      try {
        existingMcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
      } catch {
        // If parse fails, treat as no existing config
        output.push('  .mcp.json (warning: existing file was invalid JSON, replacing)');
      }
    }

    // Merge configs
    const mergedConfig = mergeMcpConfig(existingMcpConfig, targetSopConfig.mcp);

    // Report what happened
    const sopServerNames = Object.keys(targetSopConfig.mcp);
    const manualServerNames = Object.keys(mergedConfig.mcpServers || {}).filter(
      name => !sopServerNames.includes(name)
    );

    if (existingMcpConfig) {
      const previouslyManaged = existingMcpConfig._managedServers || [];
      const removed = previouslyManaged.filter(name => !sopServerNames.includes(name));

      if (manualServerNames.length > 0) {
        output.push(`  .mcp.json (preserved manual: ${manualServerNames.join(', ')})`);
      }
      if (removed.length > 0) {
        output.push(`  .mcp.json (removed managed: ${removed.join(', ')})`);
      }
      output.push(`  .mcp.json (managed: ${sopServerNames.join(', ')})`);
    } else {
      output.push(`  .mcp.json (created with: ${sopServerNames.join(', ')})`);
    }

    writeFileSync(mcpJsonPath, JSON.stringify(mergedConfig, null, 2) + '\n');
  }

  // Determine what was done for the final message
  const mcpUpdated = targetSopConfig?.mcp && Object.keys(targetSopConfig.mcp).length > 0;

  if (claudeExists && mcpUpdated) {
    output.push('\nDone. .mcp.json updated.');
  } else if (claudeExists && !mcpUpdated) {
    output.push('\nNo changes. Create sop/sop.json to configure, or use sop-expert agent.');
  } else {
    output.push('\nDone. .claude/ is ready.');
  }
  return output.join('\n');
}
