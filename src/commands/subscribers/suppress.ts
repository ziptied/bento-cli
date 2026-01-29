import type { Command } from "commander";

import { output } from "../../core/output";
import { Safety, safety } from "../../core/safety";
import { bento } from "../../core/sdk";
import { handleSubscriberError, printCsvErrors, resolveEmailTargets } from "./helpers";

interface SuppressOptions {
  email?: string;
  file?: string;
  unsuppress?: boolean;
  dryRun?: boolean;
  limit?: string;
  sample?: string;
  confirm?: boolean;
}

export function registerSuppressCommand(subscribers: Command): void {
  const command = subscribers
    .command("suppress")
    .description("Suppress or unsuppress subscribers")
    .option("-e, --email <email>", "Single email to (un)suppress")
    .option("-f, --file <file>", "CSV or newline list of subscriber emails")
    .option("--unsuppress", "Unsuppress instead of suppressing");

  Safety.addFlags(command);

  command.action(async (opts: SuppressOptions) => {
    try {
      const targets = await resolveEmailTargets({ email: opts.email, file: opts.file });
      if (!targets) {
        output.error("Provide --email <email> or --file <path> to select subscribers.");
        process.exit(2);
      }

      if (targets.errors.length > 0) {
        printCsvErrors(targets.errors);
        process.exit(6);
      }

      const actionName = opts.unsuppress ? "Unsuppress Subscribers" : "Suppress Subscribers";

      await safety.protect<string, void>(
        {
          name: actionName,
          items: targets.emails,
          formatItem: (email) => ({ email }),
          isDangerous: true,
          execute: async (emails) => {
            for (const email of emails) {
              if (opts.unsuppress) {
                await bento.subscribe(email);
              } else {
                await bento.unsubscribe(email);
              }
            }
            emitSuppressResult(emails.length, opts.unsuppress ?? false);
          },
        },
        Safety.parseOptions(opts)
      );
    } catch (error) {
      handleSubscriberError(error);
    }
  });
}

function emitSuppressResult(count: number, unsuppress: boolean): void {
  if (output.isJson()) {
    output.json({
      success: true,
      error: null,
      data: {
        updated: count,
        action: unsuppress ? "unsuppress" : "suppress",
      },
      meta: { count },
    });
    return;
  }

  const verb = unsuppress ? "Unsuppressed" : "Suppressed";
  output.success(`${verb} ${count} subscriber(s).`);
}
