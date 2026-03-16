import type { Command } from "commander";

import { output } from "../../core/output";
import { bento, CLIError } from "../../core/sdk";

interface UpsertOptions {
  email: string;
  fields?: string;
  tags?: string;
  removeTags?: string;
}

export function registerUpsertCommand(subscribers: Command): void {
  subscribers
    .command("upsert")
    .description("Create or update a subscriber with fields and tags")
    .requiredOption("-e, --email <email>", "Subscriber email address")
    .option("--fields <json>", "Fields as JSON object (e.g., '{\"name\": \"John\"}')")
    .option("--tags <csv>", "Comma-separated tags to add")
    .option("--remove-tags <csv>", "Comma-separated tags to remove")
    .action(async (opts: UpsertOptions) => {
      try {
        let fields: Record<string, unknown> | undefined;
        if (opts.fields) {
          try {
            fields = JSON.parse(opts.fields);
          } catch {
            output.error("Invalid JSON in --fields. Ensure valid JSON format.");
            process.exit(1);
          }
        }

        output.startSpinner("Upserting subscriber...");

        const result = await bento.upsertSubscriber(
          opts.email,
          fields,
          opts.tags,
          opts.removeTags
        );

        output.stopSpinner("Subscriber upserted");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Upserted subscriber ${opts.email}`);
        }
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
