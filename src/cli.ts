import { Command } from "commander";

import { output } from "./core/output";
import { registerAuthCommands } from "./commands/auth";
import { registerProfileCommands } from "./commands/profile";

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

// Future commands to be implemented:
// - subscribers (search, import, tag, suppress)
// - tags (list, create, delete)
// - fields (list, create)
// - events (track)
// - broadcasts (list, create)
// - stats (site)
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
