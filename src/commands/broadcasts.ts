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
import type { Broadcast, BroadcastType, CreateBroadcastInput } from "../types/sdk";

interface ListOptions {
  page?: string;
  perPage?: string;
}

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
    .description("List broadcasts")
    .option("--page <n>", "Page number (paginate instead of fetching all)")
    .option("--per-page <n>", "Results per page (default: 25, implies pagination)")
    .action(async (options: ListOptions) => {
      try {
        const paginated = options.page !== undefined || options.perPage !== undefined;

        if (paginated) {
          const page = parsePositiveInteger(options.page ?? "1", "--page");
          const perPage = parsePositiveInteger(options.perPage ?? "25", "--per-page");

          output.startSpinner("Fetching broadcasts...");
          const result = await bento.getBroadcastsPage(page, perPage);
          output.stopSpinner();

          if (result.broadcasts.length === 0) {
            if (output.isJson()) {
              output.json({
                success: true,
                error: null,
                data: [],
                meta: { count: 0, page, pageSize: perPage, total: result.total ?? 0, hasMore: false },
              });
            } else {
              output.info("No broadcasts found.");
            }
            return;
          }

          const rows = broadcastsToRows(result.broadcasts);

          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: rows,
              meta: {
                count: rows.length,
                total: result.total,
                page,
                pageSize: perPage,
                hasMore: result.hasMore,
              },
            });
          } else {
            output.table(rows, {
              columns: broadcastColumns(),
              meta: { total: result.total },
            });

            if (!output.isQuiet()) {
              const totalText = typeof result.total === "number" ? ` of ${result.total}` : "";
              const moreText = result.hasMore ? " (more available)" : "";
              output.info(`Page ${page}, showing ${rows.length}${totalText}${moreText}`);
            }
          }
        } else {
          // Default: fetch all broadcasts (original behavior)
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

          output.table(broadcastsToRows(broadcastList), {
            columns: broadcastColumns(),
            meta: { total: broadcastList.length },
          });
        }
      } catch (error) {
        output.failSpinner();
        if (error instanceof CLIError) {
          output.error(error.message);
        } else if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
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
        output.failSpinner();
        if (error instanceof CLIError) {
          output.error(error.message);
        } else if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });
}

function broadcastsToRows(broadcasts: Broadcast[]) {
  return broadcasts.map((b) => {
    const attrs = b.attributes as Record<string, unknown>;
    const template = attrs.template as { subject?: string } | undefined;
    const stats = attrs.stats as { recipients?: number; total_opens?: number; total_clicks?: number } | undefined;

    return {
      name: attrs.name as string,
      subject: template?.subject ?? (attrs.subject as string) ?? "-",
      recipients: stats?.recipients?.toLocaleString() ?? "-",
      opens: stats?.total_opens?.toLocaleString() ?? "-",
      clicks: stats?.total_clicks?.toLocaleString() ?? "-",
      created: formatDate(attrs.created_at as string),
    };
  });
}

function broadcastColumns() {
  return [
    { key: "name" as const, header: "NAME" },
    { key: "subject" as const, header: "SUBJECT" },
    { key: "recipients" as const, header: "SENT" },
    { key: "opens" as const, header: "OPENS" },
    { key: "clicks" as const, header: "CLICKS" },
    { key: "created" as const, header: "CREATED" },
  ];
}

function parsePositiveInteger(value: string, flag: string): number {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    output.error(`${flag} must be a positive integer.`);
    process.exit(2);
  }
  return numeric;
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
