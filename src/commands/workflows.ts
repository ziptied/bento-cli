/**
 * Workflow commands
 *
 * Commands:
 * - bento workflows list - List all workflows
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

export function registerWorkflowsCommands(program: Command): void {
  const workflows = program
    .command("workflows")
    .description("Manage workflows");

  workflows
    .command("list")
    .description("List all workflows")
    .action(async () => {
      try {
        output.startSpinner("Fetching workflows...");

        const result = await bento.getWorkflows();

        output.stopSpinner();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: result.length },
          });
          return;
        }

        if (output.isQuiet()) return;

        if (!result || result.length === 0) {
          output.info("No workflows found.");
          return;
        }

        output.table(
          result.map((w) => ({
            id: w.id,
            name: w.attributes?.name ?? "N/A",
            created_at: w.attributes?.created_at ?? "N/A",
            templates: w.attributes?.email_templates?.length ?? 0,
          })),
          {
            columns: [
              { key: "id", header: "ID" },
              { key: "name", header: "Name" },
              { key: "created_at", header: "Created" },
              { key: "templates", header: "Templates" },
            ],
          }
        );
      } catch (error) {
        output.failSpinner();
        if (error instanceof CLIError || error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });
}
