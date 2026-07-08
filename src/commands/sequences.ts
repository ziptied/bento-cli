/**
 * Sequence commands
 *
 * Commands:
 * - bento sequences list - List all sequences
 * - bento sequences create-email - Create an email template in a sequence
 * - bento sequences update-email - Update an existing sequence email template
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { output } from "../core/output";
import { CLIError, bento } from "../core/sdk";
import type {
  CreateSequenceEmailInput,
  SequenceDelayInterval,
  UpdateSequenceEmailInput,
} from "../types/sdk";
import { getSequenceId } from "../utils/sequence-identity";

interface CreateEmailOptions {
  sequenceId?: string;
  sequenceName?: string;
  subject: string;
  html?: string;
  htmlFile?: string;
  inboxSnippet?: string;
  delayInterval?: SequenceDelayInterval;
  delayCount?: string;
  editorChoice?: string;
  cc?: string;
  bcc?: string;
  to?: string;
}

interface UpdateEmailOptions {
  templateId: string;
  subject?: string;
  html?: string;
  htmlFile?: string;
}

const ALLOWED_DELAY_INTERVALS: SequenceDelayInterval[] = ["minutes", "hours", "days", "months"];
const MAX_TEMPLATE_HTML_BYTES = 524_288;
const MAX_DELAY_COUNT = 999;

export function registerSequencesCommands(program: Command): void {
  const sequences = program.command("sequences").description("Manage email sequences");

  sequences
    .command("list")
    .description("List sequences")
    .action(async () => {
      output.startSpinner("Fetching sequences...");
      try {
        const result = await bento.getSequences();
        output.stopSpinner();

        if (result.length === 0) {
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

        const rows = result.map((sequence) => ({
          sequenceId: getSequenceId(sequence) ?? "—",
          name: sequence.attributes.name,
          emails: sequence.attributes.email_templates.length,
          created: formatDate(sequence.attributes.created_at),
        }));

        output.table(rows, {
          columns: [
            { key: "sequenceId", header: "SEQUENCE ID" },
            { key: "name", header: "NAME" },
            { key: "emails", header: "EMAILS" },
            { key: "created", header: "CREATED" },
          ],
          meta: { total: rows.length },
        });
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  sequences
    .command("create-email")
    .description("Append a new email template to a sequence")
    .option("--sequence-id <id>", "Sequence ID from 'bento sequences list'")
    .option("--sequence-name <name>", "Sequence name (exact match, case-insensitive)")
    .requiredOption("--subject <subject>", "Email subject line")
    .option("--html <html>", "Email HTML content")
    .option("--html-file <path>", "Path to an HTML file")
    .option("--inbox-snippet <text>", "Inbox preview/snippet text")
    .option("--delay-interval <interval>", "Delay interval: minutes, hours, days, months")
    .option("--delay-count <n>", "Delay interval count (positive integer)")
    .option("--editor-choice <choice>", "Editor choice, e.g. plain, fancy, or raw")
    .option("--cc <cc>", "CC value (supports Liquid)")
    .option("--bcc <bcc>", "BCC value (supports Liquid)")
    .option("--to <to>", "Recipient value (supports Liquid)")
    .action(async (options: CreateEmailOptions) => {
      try {
        const sequenceId = await bento.resolveSequenceIdForEmail({
          sequenceId: options.sequenceId,
          sequenceName: options.sequenceName,
        });
        const html = await resolveHtmlInput(options.html, options.htmlFile);
        validateDelayOptions(options.delayInterval, options.delayCount);

        const input: CreateSequenceEmailInput = {
          subject: options.subject,
          html,
          inboxSnippet: options.inboxSnippet,
          delayInterval: options.delayInterval,
          delayCount: options.delayCount ? Number.parseInt(options.delayCount, 10) : undefined,
          editorChoice: options.editorChoice,
          cc: options.cc,
          bcc: options.bcc,
          to: options.to,
        };

        output.startSpinner("Creating sequence email...");
        const result = await bento.createSequenceEmail(sequenceId, input);
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

        const templateId = result?.id;
        if (templateId) {
          output.success(`Created email ${templateId} in sequence ${sequenceId}`);
        } else {
          output.success(`Created email in sequence ${sequenceId}`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  sequences
    .command("update-email")
    .description("Patch an existing sequence email template by template ID")
    .requiredOption("--template-id <id>", "Email template ID (e.g. 12345)")
    .option("--subject <subject>", "New email subject line")
    .option("--html <html>", "New email HTML content")
    .option("--html-file <path>", "Path to an HTML file")
    .action(async (options: UpdateEmailOptions) => {
      try {
        const html = await resolveOptionalHtmlInput(options.html, options.htmlFile);
        if (!options.subject && !html) {
          throw new CLIError(
            "At least one of --subject, --html, or --html-file must be provided.",
            "VALIDATION_ERROR",
            422
          );
        }

        const input: UpdateSequenceEmailInput = {
          subject: options.subject,
          html,
        };

        output.startSpinner("Updating sequence email...");
        const result = await bento.updateSequenceEmail(options.templateId, input);
        output.stopSpinner("Sequence email updated");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: result ? 1 : 0 },
          });
          return;
        }

        output.success(`Updated email template ${options.templateId}`);
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });
}

async function resolveHtmlInput(html?: string, htmlFile?: string): Promise<string> {
  const hasInlineHtml = Boolean(html);
  const hasHtmlFile = Boolean(htmlFile);

  if (hasInlineHtml === hasHtmlFile) {
    throw new CLIError("Provide exactly one of --html or --html-file.", "VALIDATION_ERROR", 422);
  }

  if (html) {
    validateHtmlSize(html);
    return html;
  }

  try {
    const safePath = resolveSafeHtmlPath(htmlFile as string);
    const content = await readFile(safePath, "utf8");
    validateHtmlSize(content);
    return content;
  } catch (error) {
    if (error instanceof CLIError) throw error;
    if (error instanceof Error && "code" in error) {
      const code = String(error.code);
      if (code === "ENOENT") {
        throw new CLIError(`HTML file not found: ${htmlFile}`, "VALIDATION_ERROR", 422);
      }
      if (code === "EACCES") {
        throw new CLIError(
          `Cannot read HTML file (permission denied): ${htmlFile}`,
          "VALIDATION_ERROR",
          422
        );
      }
    }
    throw new CLIError(`Unable to read HTML file: ${htmlFile}`, "VALIDATION_ERROR", 422);
  }
}

async function resolveOptionalHtmlInput(
  html?: string,
  htmlFile?: string
): Promise<string | undefined> {
  if (!html && !htmlFile) return undefined;
  return resolveHtmlInput(html, htmlFile);
}

function validateDelayOptions(delayInterval?: string, delayCount?: string): void {
  if ((delayInterval && !delayCount) || (!delayInterval && delayCount)) {
    throw new CLIError(
      "--delay-interval and --delay-count must be provided together.",
      "VALIDATION_ERROR",
      422
    );
  }

  if (delayInterval && !ALLOWED_DELAY_INTERVALS.includes(delayInterval as SequenceDelayInterval)) {
    throw new CLIError(
      `--delay-interval must be one of: ${ALLOWED_DELAY_INTERVALS.join(", ")}`,
      "VALIDATION_ERROR",
      422
    );
  }

  if (delayCount) {
    const parsed = Number.parseInt(delayCount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== delayCount) {
      throw new CLIError("--delay-count must be a positive integer.", "VALIDATION_ERROR", 422);
    }
    if (parsed > MAX_DELAY_COUNT) {
      throw new CLIError(
        `--delay-count must be less than or equal to ${MAX_DELAY_COUNT}.`,
        "VALIDATION_ERROR",
        422
      );
    }
  }
}

function validateHtmlSize(html: string): void {
  if (Buffer.byteLength(html, "utf8") > MAX_TEMPLATE_HTML_BYTES) {
    throw new CLIError(
      `HTML content must be under ${MAX_TEMPLATE_HTML_BYTES} bytes.`,
      "VALIDATION_ERROR",
      422
    );
  }
}

function resolveSafeHtmlPath(inputPath: string): string {
  const resolvedPath = path.resolve(inputPath);
  const projectRoot = process.cwd();
  const relativePath = path.relative(projectRoot, resolvedPath);
  const isOutsideProject = relativePath.startsWith("..") || path.isAbsolute(relativePath);

  if (isOutsideProject) {
    throw new CLIError(
      "HTML file path must be within the current working directory.",
      "VALIDATION_ERROR",
      422
    );
  }

  return resolvedPath;
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
