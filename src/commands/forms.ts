/**
 * Form commands
 *
 * Commands:
 * - bento forms responses <form-id> - Get form responses
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

export function registerFormsCommands(program: Command): void {
  const forms = program
    .command("forms")
    .description("Manage forms and responses");

  forms
    .command("responses")
    .description("Get responses for a form")
    .argument("<form-id>", "Form identifier")
    .action(async (formId: string) => {
      try {
        output.startSpinner("Fetching form responses...");

        const result = await bento.getFormResponses(formId);

        output.stopSpinner();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: result?.length ?? 0 },
          });
          return;
        }

        if (output.isQuiet()) return;

        if (!result || result.length === 0) {
          output.info("No responses found for this form.");
          return;
        }

        output.table(
          result.map((r) => ({
            id: r.id,
            uuid: r.attributes?.uuid ?? "N/A",
            type: r.attributes?.data?.type ?? "N/A",
            date: r.attributes?.data?.date ?? "N/A",
            ip: r.attributes?.data?.ip ?? "N/A",
          })),
          {
            columns: [
              { key: "id", header: "ID" },
              { key: "uuid", header: "UUID" },
              { key: "type", header: "Type" },
              { key: "date", header: "Date" },
              { key: "ip", header: "IP" },
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
