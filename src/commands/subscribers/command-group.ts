import type { Command } from "commander";

import { registerImportCommand } from "./import";
import { registerSearchCommand } from "./search";
import { registerSuppressCommand } from "./suppress";
import { registerTagCommand } from "./tag";

export function registerSubscribersCommands(program: Command): void {
  const subscribers = program.command("subscribers").description("Manage subscribers");

  registerSearchCommand(subscribers);
  registerImportCommand(subscribers);
  registerTagCommand(subscribers);
  registerSuppressCommand(subscribers);
}
