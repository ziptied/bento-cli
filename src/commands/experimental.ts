/**
 * Experimental commands
 *
 * Commands:
 * - bento experimental validate-email <email> [--ip <ip>] [--name <name>] [--user-agent <ua>]
 * - bento experimental guess-gender <name>
 * - bento experimental geolocate <ip>
 * - bento experimental blacklist --domain <d> | --ip <ip>
 * - bento experimental moderate <content>
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

interface ValidateEmailOptions {
  ip?: string;
  name?: string;
  userAgent?: string;
}

interface BlacklistOptions {
  domain?: string;
  ip?: string;
}

export function registerExperimentalCommands(program: Command): void {
  const experimental = program
    .command("experimental")
    .description("Experimental features (may change without notice)");

  experimental
    .command("validate-email")
    .description("Validate an email address")
    .argument("<email>", "Email address to validate")
    .option("--ip <ip>", "IP address of the user")
    .option("--name <name>", "Name of the user")
    .option("--user-agent <ua>", "User agent string")
    .action(async (email: string, opts: ValidateEmailOptions) => {
      try {
        output.startSpinner("Validating email...");

        const valid = await bento.validateEmail(email, opts.ip, opts.name, opts.userAgent);

        output.stopSpinner();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { email, valid },
            meta: { count: 1 },
          });
          return;
        }

        if (output.isQuiet()) return;

        if (valid) {
          output.success(`${email} is valid.`);
        } else {
          output.warn(`${email} could not be validated.`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  experimental
    .command("guess-gender")
    .description("Guess gender from a name using US Census data")
    .argument("<name>", "Name to analyze")
    .action(async (name: string) => {
      try {
        output.startSpinner("Guessing gender...");

        const result = await bento.guessGender(name);

        output.stopSpinner();

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

        output.object({
          Name: name,
          Gender: result.gender ?? "Unknown",
          Confidence: result.confidence !== null ? `${(result.confidence * 100).toFixed(1)}%` : "N/A",
        });
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  experimental
    .command("geolocate")
    .description("Geolocate an IP address")
    .argument("<ip>", "IP address to geolocate")
    .action(async (ip: string) => {
      try {
        output.startSpinner("Geolocating...");

        const result = await bento.geolocate(ip);

        output.stopSpinner();

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

        if (result && typeof result === "object") {
          output.object(result as Record<string, unknown>);
        } else {
          output.info("No location data returned.");
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  experimental
    .command("blacklist")
    .description("Check if a domain or IP is blacklisted")
    .option("-d, --domain <domain>", "Domain to check")
    .option("--ip <ip>", "IP address to check")
    .action(async (opts: BlacklistOptions) => {
      try {
        if (!opts.domain && !opts.ip) {
          output.error("Provide --domain or --ip to check.");
          process.exit(1);
        }

        output.startSpinner("Checking blacklist...");

        const result = await bento.checkBlacklist(opts.domain, opts.ip);

        output.stopSpinner();

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

        output.object({
          Query: result.query,
          Description: result.description,
          Results: JSON.stringify(result.results),
        });
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  experimental
    .command("moderate")
    .description("Perform content moderation on text")
    .argument("<content>", "Text content to moderate")
    .action(async (content: string) => {
      try {
        output.startSpinner("Moderating content...");

        const result = await bento.getContentModeration(content);

        output.stopSpinner();

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

        if (result.flagged) {
          output.warn("Content was FLAGGED for moderation.");
        } else {
          output.success("Content passed moderation.");
        }

        output.newline();
        output.object({
          Flagged: String(result.flagged),
          ...Object.fromEntries(
            Object.entries(result.categories).map(([k, v]) => [`Category: ${k}`, String(v)])
          ),
        });
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
