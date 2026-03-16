import type { Command } from "commander";

import { output } from "../../core/output";
import { bento, CLIError } from "../../core/sdk";

interface ChangeEmailOptions {
  old: string;
  new: string;
}

export function registerChangeEmailCommand(subscribers: Command): void {
  subscribers
    .command("change-email")
    .description("Change a subscriber's email address")
    .requiredOption("--old <email>", "Current email address")
    .requiredOption("--new <email>", "New email address")
    .action(async (opts: ChangeEmailOptions) => {
      try {
        output.startSpinner("Changing email...");

        const result = await bento.changeEmail(opts.old, opts.new);

        output.stopSpinner("Email changed");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result,
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Changed email from ${opts.old} to ${opts.new}`);
        }
      } catch (error) {
        output.failSpinner();
        if (error instanceof CLIError || error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });
}
