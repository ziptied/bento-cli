/**
 * Broadcasts commands
 *
 * Commands:
 * - bento broadcasts list - List all broadcasts
 * - bento broadcasts create --name <n> --subject <s> [options] - Create a new broadcast draft
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";
import type { BroadcastType, CreateBroadcastInput } from "../types/sdk";

interface CreateOptions {
  name: string;
  subject: string;
  content?: string;
  type?: BroadcastType;
  fromName?: string;
  fromEmail?: string;
  includeTags?: string;
  excludeTags?: string;
  batchSize?: string;
}

export function registerBroadcastsCommands(program: Command): void {
  const broadcasts = program
    .command("broadcasts")
    .description("Manage email broadcasts");

  broadcasts
    .command("list")
    .description("List all broadcasts")
    .action(async () => {
      try {
        output.startSpinner("Fetching broadcasts...");

        const broadcastList = await bento.getBroadcasts();
        output.stopSpinner();

        if (broadcastList.length === 0) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: [],
              meta: { count: 0 },
            });
          } else {
            output.info("No broadcasts found.");
          }
          return;
        }

        output.table(
          broadcastList.map((b) => ({
            name: b.attributes.name,
            subject: b.attributes.subject,
            type: b.attributes.type,
            from: `${b.attributes.from.name} <${b.attributes.from.email}>`,
            batchSize: b.attributes.batch_size_per_hour.toLocaleString(),
            created: formatDate(b.attributes.created_at),
          })),
          {
            columns: [
              { key: "name", header: "NAME" },
              { key: "subject", header: "SUBJECT" },
              { key: "type", header: "TYPE" },
              { key: "from", header: "FROM" },
              { key: "batchSize", header: "BATCH/HR" },
              { key: "created", header: "CREATED" },
            ],
            meta: { total: broadcastList.length },
          }
        );
      } catch (error) {
        if (error instanceof CLIError) {
          output.failSpinner();
          output.error(error.message);
          process.exit(1);
        }
        throw error;
      }
    });

  broadcasts
    .command("create")
    .description("Create a new broadcast draft")
    .requiredOption("-n, --name <name>", "Broadcast name (internal identifier)")
    .requiredOption("-s, --subject <subject>", "Email subject line")
    .option("-c, --content <content>", "Email content (HTML, plain text, or markdown)")
    .option("-t, --type <type>", "Content type: plain, html, or markdown", "html")
    .option("--from-name <name>", "Sender name")
    .option("--from-email <email>", "Sender email address")
    .option("--include-tags <tags>", "Comma-separated tags to include")
    .option("--exclude-tags <tags>", "Comma-separated tags to exclude")
    .option("--batch-size <size>", "Emails to send per hour", "1000")
    .action(async (options: CreateOptions) => {
      try {
        // Validate type
        const validTypes: BroadcastType[] = ["plain", "html", "markdown"];
        const contentType = (options.type || "html") as BroadcastType;
        if (!validTypes.includes(contentType)) {
          output.error(`Invalid type "${options.type}". Must be one of: ${validTypes.join(", ")}`);
          process.exit(1);
        }

        // Parse batch size
        const batchSize = parseInt(options.batchSize || "1000", 10);
        if (isNaN(batchSize) || batchSize < 1) {
          output.error("Batch size must be a positive number.");
          process.exit(1);
        }

        // Build broadcast input
        const input: CreateBroadcastInput = {
          name: options.name,
          subject: options.subject,
          content: options.content || "",
          type: contentType,
          from: {
            name: options.fromName || "",
            email: options.fromEmail || "",
          },
          batch_size_per_hour: batchSize,
        };

        if (options.includeTags) {
          input.inclusive_tags = options.includeTags;
        }

        if (options.excludeTags) {
          input.exclusive_tags = options.excludeTags;
        }

        output.startSpinner("Creating broadcast...");

        const result = await bento.createBroadcast(input);
        output.stopSpinner("Broadcast created");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: result.length },
          });
        } else if (!output.isQuiet()) {
          output.success(`Created broadcast "${options.name}"`);
          output.info("Edit and send this broadcast from the Bento web dashboard.");
        }
      } catch (error) {
        if (error instanceof CLIError) {
          output.failSpinner();
          output.error(error.message);
          process.exit(1);
        }
        throw error;
      }
    });
}

/**
 * Format ISO date string for display
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
