/**
 * Transactional email commands
 *
 * Commands:
 * - bento emails send --to <e> --from <e> --subject <s> --html-body <html> [--personalizations <json>]
 * - bento emails send-batch --file <json>
 */

import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";
import type { TransactionalEmail } from "../types/sdk";

interface SendOptions {
  to: string;
  from: string;
  subject: string;
  htmlBody: string;
  personalizations?: string;
}

interface SendBatchOptions {
  file: string;
}

export function registerEmailsCommands(program: Command): void {
  const emails = program
    .command("emails")
    .description("Send transactional emails");

  emails
    .command("send")
    .description("Send a single transactional email")
    .requiredOption("--to <email>", "Recipient email address")
    .requiredOption("--from <email>", "Sender email address")
    .requiredOption("--subject <subject>", "Email subject")
    .requiredOption("--html-body <html>", "Email HTML body")
    .option("--personalizations <json>", "Personalizations as JSON for liquid tags")
    .action(async (opts: SendOptions) => {
      try {
        let personalizations: Record<string, string | number | boolean> | undefined;
        if (opts.personalizations) {
          try {
            personalizations = JSON.parse(opts.personalizations);
          } catch {
            output.error("Invalid JSON in --personalizations. Ensure valid JSON format.");
            process.exit(1);
          }
        }

        const email: TransactionalEmail = {
          to: opts.to,
          from: opts.from,
          subject: opts.subject,
          html_body: opts.htmlBody,
          transactional: true,
          personalizations,
        };

        output.startSpinner("Sending email...");

        const count = await bento.sendTransactionalEmails([email]);

        output.stopSpinner("Email sent");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { queued: count },
            meta: { count },
          });
        } else if (!output.isQuiet()) {
          output.success(`Sent transactional email to ${opts.to}`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  emails
    .command("send-batch")
    .description("Send a batch of transactional emails (up to 100)")
    .requiredOption("-f, --file <json>", "JSON file with array of email objects")
    .action(async (opts: SendBatchOptions) => {
      try {
        let emailData: TransactionalEmail[];
        try {
          const raw = await readFile(opts.file, "utf-8");
          emailData = JSON.parse(raw);
        } catch {
          output.error(`Failed to read or parse ${opts.file}. Ensure it is valid JSON.`);
          process.exit(1);
        }

        if (!Array.isArray(emailData) || emailData.length === 0) {
          output.error("File must contain a non-empty array of email objects.");
          process.exit(1);
        }

        if (emailData.length > 100) {
          output.error("Batch limit is 100 emails. Please split into smaller batches.");
          process.exit(1);
        }

        const emails: TransactionalEmail[] = emailData.map((e) => ({
          ...e,
          transactional: true,
        }));

        output.startSpinner(`Sending ${emails.length} email(s)...`);

        const count = await bento.sendTransactionalEmails(emails);

        output.stopSpinner("Batch sent");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { queued: count },
            meta: { count },
          });
        } else if (!output.isQuiet()) {
          output.success(`Queued ${count} transactional email(s) for delivery.`);
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
