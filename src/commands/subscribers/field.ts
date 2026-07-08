import type { Command } from "commander";

import { output } from "../../core/output";
import { bento, CLIError } from "../../core/sdk";

interface FieldSetOptions {
  email: string;
  key: string;
  value: string;
}

interface FieldRemoveOptions {
  email: string;
  key: string;
}

interface FieldUpdateOptions {
  email: string;
  fields: string;
}

export function registerFieldCommand(subscribers: Command): void {
  const field = subscribers
    .command("field")
    .description("Manage subscriber fields");

  field
    .command("set")
    .description("Set a field value on a subscriber (does NOT trigger automations)")
    .requiredOption("-e, --email <email>", "Subscriber email address")
    .requiredOption("-k, --key <key>", "Field key")
    .requiredOption("-v, --value <value>", "Field value")
    .action(async (opts: FieldSetOptions) => {
      try {
        output.startSpinner("Setting field...");

        const result = await bento.addField({
          email: opts.email,
          field: { key: opts.key, value: opts.value },
        });

        output.stopSpinner("Field set");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Set field "${opts.key}" = "${opts.value}" on ${opts.email}`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  field
    .command("remove")
    .description("Remove a field from a subscriber")
    .requiredOption("-e, --email <email>", "Subscriber email address")
    .requiredOption("-k, --key <key>", "Field key to remove")
    .action(async (opts: FieldRemoveOptions) => {
      try {
        output.startSpinner("Removing field...");

        const result = await bento.removeField(opts.email, opts.key);

        output.stopSpinner("Field removed");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Removed field "${opts.key}" from ${opts.email}`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  field
    .command("update")
    .description("Update multiple fields on a subscriber (TRIGGERS automations)")
    .requiredOption("-e, --email <email>", "Subscriber email address")
    .requiredOption("--fields <json>", "Fields as JSON object (e.g., '{\"name\": \"John\"}')")
    .action(async (opts: FieldUpdateOptions) => {
      try {
        let fields: Record<string, unknown>;
        try {
          fields = JSON.parse(opts.fields);
        } catch {
          output.error("Invalid JSON in --fields. Ensure valid JSON format.");
          process.exit(1);
        }

        output.startSpinner("Updating fields...");

        const success = await bento.updateFields(opts.email, fields);

        if (!success) {
          output.failSpinner("Failed to update fields");
          process.exit(1);
        }

        output.stopSpinner("Fields updated");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { email: opts.email, fields },
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Updated fields on ${opts.email} (automations triggered)`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });
}

function handleError(error: unknown): void {
  if (error instanceof CLIError || error instanceof Error) {
    output.error(error.message);
  } else {
    output.error("An unexpected error occurred.");
  }
  process.exit(1);
}
