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

describe("subscribers unsubscribe command", () => {
  afterEach(() => {
    output.reset();
  });

  it("unsubscribes a single email", async () => {
    const unsubscribeSpy = spyOn(bento, "unsubscribe").mockResolvedValue(null);

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "unsubscribe",
      "--email",
      "user@example.com",
      "--confirm",
    ]);

    expect(unsubscribeSpy).toHaveBeenCalledWith("user@example.com");

    unsubscribeSpy.mockRestore();
  });

  it("shows help with --help flag", async () => {
    const program = buildProgram();

    let helpOutput = "";
    program.configureOutput({
      writeOut: (str) => { helpOutput += str; },
      writeErr: (str) => { helpOutput += str; },
    });

    try {
      await program.parseAsync(["node", "test", "subscribers", "unsubscribe", "--help"]);
    } catch {
      // Commander throws on --help with exitOverride
    }

    expect(helpOutput).toContain("Unsubscribe subscribers");
    expect(helpOutput).toContain("--email");
    expect(helpOutput).toContain("--file");
  });
});
