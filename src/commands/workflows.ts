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

        const hasStatus = result.some((w) => "status" in (w.attributes ?? {}));

        const columns = [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          ...(hasStatus ? [{ key: "status", header: "Status" }] : []),
          { key: "created_at", header: "Created" },
          { key: "templates", header: "Templates" },
        ];

        output.table(
          result.map((w) => ({
            id: w.id,
            name: w.attributes?.name ?? "N/A",
            ...(hasStatus ? { status: (w.attributes as any)?.status ?? "N/A" } : {}),
            created_at: w.attributes?.created_at ?? "N/A",
            templates: w.attributes?.email_templates?.length ?? 0,
          })),
          { columns }
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
