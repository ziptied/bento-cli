import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { registerSubscribersCommands } from "../../../commands/subscribers";
import { output } from "../../../core/output";
import { bento } from "../../../core/sdk";

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSubscribersCommands(program);
  return program;
}

describe("subscribers suppress command", () => {
  afterEach(() => {
    output.reset();
  });

  it("suppresses emails via unsubscribe", async () => {
    const unsubscribeSpy = spyOn(bento, "unsubscribe").mockResolvedValue(null);

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "suppress",
      "--email",
      "user@example.com",
      "--confirm",
    ]);

    expect(unsubscribeSpy).toHaveBeenCalledWith("user@example.com");

    unsubscribeSpy.mockRestore();
  });

  it("unsuppresses emails via subscribe", async () => {
    const subscribeSpy = spyOn(bento, "subscribe").mockResolvedValue(null);

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "suppress",
      "--email",
      "user@example.com",
      "--unsuppress",
      "--confirm",
    ]);

    expect(subscribeSpy).toHaveBeenCalledWith("user@example.com");

    subscribeSpy.mockRestore();
  });
});
