import { Command } from "commander";

import { registerAuthCommands } from "./commands/auth";
import { registerBroadcastsCommands } from "./commands/broadcasts";
import { registerEventsCommands } from "./commands/events";
import { registerFieldsCommands } from "./commands/fields";
import { registerProfileCommands } from "./commands/profile";
import { registerStatsCommands } from "./commands/stats";
import { registerSubscribersCommands } from "./commands/subscribers";
import { registerTagsCommands } from "./commands/tags";
import { output } from "./core/output";

const program = new Command();

program
  .name("bento")
  .description(
    "Bento CLI - Command-oriented and conversational interface for Bento email marketing"
  )
  .version("0.1.0")
  .option("--json", "Output machine-readable JSON")
  .option("--quiet", "Suppress non-essential output (errors still print)")
  .hook("preAction", (thisCommand) => {
    configureOutputMode(thisCommand.optsWithGlobals());
  })
  .action(() => {
    if (output.isJson()) {
      output.jsonError("No command provided. Pass a command or remove --json.", {
        code: 2,
        count: 0,
      });
      process.exit(2);
    }

    if (output.isQuiet()) {
      return;
    }

    program.outputHelp();
  });

// Register command groups
registerAuthCommands(program);
registerProfileCommands(program);
registerSubscribersCommands(program);
registerTagsCommands(program);
registerFieldsCommands(program);
registerEventsCommands(program);
registerBroadcastsCommands(program);
registerStatsCommands(program);

// Future commands to be implemented:
// - subscribers (search, import, tag, suppress)
// - mcp (status, start, stop)
// - ask

program.parse();

function configureOutputMode(options: { json?: boolean; quiet?: boolean }): void {
  if (options.json && options.quiet) {
    output.error("Cannot use --json and --quiet together.");
    process.exit(2);
  }

  if (options.json) {
    output.setMode("json");
    return;
  }

  if (options.quiet) {
    output.setMode("quiet");
    return;
  }

  output.setMode("normal");
}
