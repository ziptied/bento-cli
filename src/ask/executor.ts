/**
 * MCP tool execution for 'bento ask' command
 *
 * Executes plans created by the planner, handling:
 * - Tool invocation via MCP
 * - Progress reporting
 * - Error handling
 * - Confirmation for dangerous operations
 */

import { executeTool, getMCPStatus } from "../core/mcp";
import type { Intent, Plan } from "./planner";

export interface ExecutionResult {
  success: boolean;
  results: IntentResult[];
  error?: string;
}

export interface IntentResult {
  intent: Intent;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Execute a plan, returning results for each intent
 */
export async function executePlan(
  plan: Plan,
  options: { confirm?: boolean } = {}
): Promise<ExecutionResult> {
  // Check MCP availability
  const status = await getMCPStatus();
  if (!status.running) {
    return {
      success: false,
      results: [],
      error: "MCP server is not running. Start it with 'bento mcp start' or run it externally.",
    };
  }

  const results: IntentResult[] = [];

  for (const intent of plan.intents) {
    // Check if dangerous operation needs confirmation
    if (intent.requiresConfirmation && !options.confirm) {
      results.push({
        intent,
        success: false,
        error: "Dangerous operation requires --confirm flag",
      });
      continue;
    }

    try {
      // Execute each tool in the intent
      for (const tool of intent.tools) {
        await executeTool(tool, {});
      }

      results.push({
        intent,
        success: true,
      });
    } catch (error) {
      results.push({
        intent,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    success: results.every((r) => r.success),
    results,
  };
}

/**
 * Format execution results for display
 */
export function formatResults(execution: ExecutionResult): string {
  const lines: string[] = [];

  if (execution.error) {
    lines.push(`Error: ${execution.error}`);
    return lines.join("\n");
  }

  for (const result of execution.results) {
    const status = result.success ? "OK" : "FAILED";
    lines.push(`[${status}] ${result.intent.description}`);
    if (result.error) {
      lines.push(`       ${result.error}`);
    }
  }

  return lines.join("\n");
}
