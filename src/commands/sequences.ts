/**
 * Sequences commands
 *
 * Commands:
 * - bento sequences list - List all sequences
 * - bento sequences email create <sequence-id> --subject <subject> --html <html>
 */

import type { Command } from "commander";
import { output } from "../core/output";
import { CLIError, bento } from "../core/sdk";
import type { CreateSequenceEmailParameters, Sequence, SequenceDelayInterval } from "../types/sdk";

interface EmailCreateOptions {
  subject: string;
  html: string;
  delayInterval?: string;
  delayCount?: string;
  snippet?: string;
  editor?: string;
  cc?: string;
  bcc?: string;
  to?: string;
}

const VALID_DELAY_INTERVALS: SequenceDelayInterval[] = ["minutes", "hours", "days", "months"];

export function registerSequencesCommands(program: Command): void {
  const sequences = program.command("sequences").description("Manage email sequences");

  sequences
    .command("list")
    .description("List all sequences")
    .action(async () => {
      try {
        output.startSpinner("Fetching sequences...");
        const sequenceList = await bento.getSequences();
        output.stopSpinner();

        if (!sequenceList || sequenceList.length === 0) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: [],
              meta: { count: 0 },
            });
          } else {
            output.info("No sequences found.");
          }
          return;
        }

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: sequenceList,
            meta: { count: sequenceList.length },
          });
          return;
        }

        output.table(sequencesToRows(sequenceList), {
          columns: sequenceColumns(),
          meta: { total: sequenceList.length },
          emptyMessage: "No sequences found.",
        });
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  const email = sequences.command("email").description("Manage sequence emails");

  email
    .command("create <sequence-id>")
    .description("Create a new email in a sequence")
    .requiredOption("-s, --subject <subject>", "Email subject line")
    .requiredOption("-H, --html <html>", "Email HTML content")
    .option("--delay-interval <interval>", "Delay unit: minutes, hours, days, or months")
    .option("--delay-count <count>", "Delay amount (requires --delay-interval)")
    .option("--snippet <text>", "Inbox preview snippet")
    .option("--editor <mode>", "Editor mode")
    .option("--cc <email>", "CC email address")
    .option("--bcc <email>", "BCC email address")
    .option("--to <email>", "Override recipient email")
    .action(async (sequenceId: string, options: EmailCreateOptions) => {
      try {
        const delayInterval = parseDelayInterval(options.delayInterval);

        if (options.delayCount && !delayInterval) {
          output.error("--delay-count requires --delay-interval to be set.");
          process.exit(2);
        }

        const delayCount = options.delayCount
          ? parsePositiveInteger(options.delayCount, "--delay-count")
          : undefined;

        const params: CreateSequenceEmailParameters = {
          subject: options.subject,
          html: options.html,
          inbox_snippet: options.snippet,
          delay_interval: delayInterval,
          delay_interval_count: delayCount,
          editor_choice: options.editor,
          cc: options.cc,
          bcc: options.bcc,
          to: options.to,
        };

        output.startSpinner("Creating sequence email...");
        const result = await bento.createSequenceEmail(sequenceId, params);
        output.stopSpinner("Sequence email created");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: result ? 1 : 0 },
          });
          return;
        }

        if (!output.isQuiet()) {
          const idText = result?.id ? ` (ID: ${result.id})` : "";
          output.success(`Created sequence email "${options.subject}"${idText}`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });
}

function sequencesToRows(sequences: Sequence[]) {
  return sequences.map((sequence) => {
    const templates = sequence.attributes.email_templates ?? [];

    return {
      id: sequence.id,
      name: sequence.attributes.name,
      emails: templates.length.toString(),
      created: formatDate(sequence.attributes.created_at),
    };
  });
}

function sequenceColumns() {
  return [
    { key: "id" as const, header: "ID" },
    { key: "name" as const, header: "NAME" },
    { key: "emails" as const, header: "EMAILS" },
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

function parseDelayInterval(value?: string): SequenceDelayInterval | undefined {
  if (!value) {
    return undefined;
  }

  if (VALID_DELAY_INTERVALS.includes(value as SequenceDelayInterval)) {
    return value as SequenceDelayInterval;
  }

  output.error(
    `Invalid --delay-interval "${value}". Must be one of: ${VALID_DELAY_INTERVALS.join(", ")}`
  );
  process.exit(2);
}

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

function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    output.error(error.message);
  } else if (error instanceof Error) {
    output.error(error.message);
  } else {
    output.error("An unexpected error occurred.");
  }
  process.exit(1);
}
