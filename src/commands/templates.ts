/**
 * Email template commands
 *
 * Commands:
 * - bento templates get <id> - Get an email template
 * - bento templates update <id> [--subject <s>] [--html <h>] - Update an email template
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

interface UpdateOptions {
  subject?: string;
  html?: string;
}

export function registerTemplatesCommands(program: Command): void {
  const templates = program
    .command("templates")
    .description("Manage email templates");

  templates
    .command("get")
    .description("Get an email template by ID")
    .argument("<id>", "Email template ID")
    .action(async (id: string) => {
      try {
        output.startSpinner("Fetching template...");

        const result = await bento.getEmailTemplate(id);

        output.stopSpinner();

        if (!result) {
          output.error(`Template with ID "${id}" not found.`);
          process.exit(1);
        }

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: 1 },
          });
          return;
        }

        if (output.isQuiet()) return;

        output.object(result as unknown as Record<string, unknown>);
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  templates
    .command("update")
    .description("Update an email template")
    .argument("<id>", "Email template ID")
    .option("--subject <subject>", "New email subject")
    .option("--html <html>", "New HTML content")
    .action(async (id: string, opts: UpdateOptions) => {
      try {
        if (!opts.subject && !opts.html) {
          output.error("Provide at least --subject or --html to update.");
          process.exit(1);
        }

        output.startSpinner("Updating template...");

        const result = await bento.updateEmailTemplate(id, opts.subject, opts.html);

        output.stopSpinner("Template updated");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Updated template ${id}`);
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
