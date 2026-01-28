#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { generate } from "./generator.js";

const server = new Server(
  {
    name: "dev-sop-engine",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "sop_generate",
        description: "Generate .claude/ directory with hooks, validators, and config for a target project",
        inputSchema: {
          type: "object",
          properties: {
            targetDir: {
              type: "string",
              description: "Path to the target project directory (absolute or relative)",
            },
          },
          required: ["targetDir"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "sop_generate") {
    const targetDir = String(request.params.arguments?.targetDir || process.cwd());

    try {
      const result = generate(targetDir);
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    isError: true,
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
