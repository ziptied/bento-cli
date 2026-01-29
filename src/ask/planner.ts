/**
 * Intent classification for 'bento ask' command
 *
 * Analyzes user prompts to determine:
 * - What operation(s) the user wants to perform
 * - What MCP tools are needed
 * - Whether the operation is dangerous and requires confirmation
 */

export interface Intent {
  description: string;
  tools: string[];
  isDangerous: boolean;
  requiresConfirmation: boolean;
}

export interface Plan {
  intents: Intent[];
  summary: string;
}

/**
 * Analyze a user prompt and create an execution plan
 */
export async function createPlan(_prompt: string): Promise<Plan> {
  // TODO: Implement intent classification
  // This will likely involve LLM-based analysis
  return {
    intents: [],
    summary: "Plan not yet implemented",
  };
}

/**
 * Format plan for user display and confirmation
 */
export function formatPlan(plan: Plan): string {
  const lines: string[] = [];
  lines.push("Execution Plan:");
  lines.push("");
  lines.push(plan.summary);
  lines.push("");

  if (plan.intents.length > 0) {
    lines.push("Steps:");
    for (const [index, intent] of plan.intents.entries()) {
      const prefix = intent.isDangerous ? "[!] " : "    ";
      lines.push(`${prefix}${index + 1}. ${intent.description}`);
    }
  }

  const hasDangerous = plan.intents.some((i) => i.isDangerous);
  if (hasDangerous) {
    lines.push("");
    lines.push("[!] = Requires confirmation");
  }

  return lines.join("\n");
}
