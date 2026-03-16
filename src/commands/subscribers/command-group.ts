import type { Command } from "commander";

import { registerChangeEmailCommand } from "./change-email";
import { registerFieldCommand } from "./field";
import { registerImportCommand } from "./import";
import { registerSearchCommand } from "./search";
import { registerSubscribeCommand } from "./subscribe";
import { registerTagCommand } from "./tag";
import { registerUnsubscribeCommand } from "./unsubscribe";
import { registerUpsertCommand } from "./upsert";

export function registerSubscribersCommands(program: Command): void {
  const subscribers = program.command("subscribers").description("Manage subscribers");

  registerSearchCommand(subscribers);
  registerImportCommand(subscribers);
  registerTagCommand(subscribers);
  registerSubscribeCommand(subscribers);
  registerUnsubscribeCommand(subscribers);
  registerFieldCommand(subscribers);
  registerChangeEmailCommand(subscribers);
  registerUpsertCommand(subscribers);
}
