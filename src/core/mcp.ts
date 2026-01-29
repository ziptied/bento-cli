/**
 * MCP (Model Context Protocol) bridge
 *
 * Handles communication with the Bento MCP server for
 * conversational workflows via the 'bento ask' command.
 *
 * Modes:
 * - External: User runs bento-mcp separately
 * - Managed: CLI spawns MCP as child process
 */

export interface MCPStatus {
  running: boolean;
  mode: "external" | "managed" | null;
  pid?: number;
}

export async function getMCPStatus(): Promise<MCPStatus> {
  // TODO: Check if MCP server is running
  return {
    running: false,
    mode: null,
  };
}

export async function startMCP(): Promise<void> {
  // TODO: Start MCP server as child process
}

export async function stopMCP(): Promise<void> {
  // TODO: Stop managed MCP server
}

export async function executeTool(
  _toolName: string,
  _args: Record<string, unknown>
): Promise<unknown> {
  // TODO: Execute MCP tool and return result
  return null;
}
