import type { Command } from "commander";

import { output } from "../../core/output";
import { Safety, safety } from "../../core/safety";
import { bento } from "../../core/sdk";
import { handleSubscriberError, printCsvErrors, resolveEmailTargets } from "./helpers";

interface SubscribeOptions {
  email?: string;
  file?: string;
  dryRun?: boolean;
  limit?: string;
  sample?: string;
  confirm?: boolean;
}

export function registerSubscribeCommand(subscribers: Command): void {
  const command = subscribers
    .command("subscribe")
    .description("Re-subscribe previously unsubscribed subscribers")
    .option("-e, --email <email>", "Single email to re-subscribe")
    .option("-f, --file <file>", "CSV or newline list of subscriber emails");

  Safety.addFlags(command);

  command.action(async (opts: SubscribeOptions) => {
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

      await safety.protect<string, void>(
        {
          name: "Re-subscribe Subscribers",
          items: targets.emails,
          formatItem: (email) => ({ email }),
          isDangerous: true,
          execute: async (emails) => {
            for (const email of emails) {
              await bento.subscribe(email);
            }
            emitResult(emails.length);
          },
        },
        Safety.parseOptions(opts)
      );
    } catch (error) {
      handleSubscriberError(error);
    }
  });
}

function emitResult(count: number): void {
  if (output.isJson()) {
    output.json({
      success: true,
      error: null,
      data: {
        updated: count,
        action: "subscribe",
      },
      meta: { count },
    });
    return;
  }

  output.success(`Re-subscribed ${count} subscriber(s).`);
}
