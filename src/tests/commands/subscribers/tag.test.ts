import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

import { registerSubscribersCommands } from "../../../commands/subscribers";
import { output } from "../../../core/output";
import { bento } from "../../../core/sdk";

let tempDir: string;

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSubscribersCommands(program);
  return program;
}

describe("subscribers tag command", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-tag-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    output.reset();
  });

  it("adds tags to a single email", async () => {
    const addSpy = spyOn(bento, "addTag").mockResolvedValue(null);

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "tag",
      "--email",
      "user@example.com",
      "--add",
      "vip",
      "--confirm",
    ]);

    expect(addSpy).toHaveBeenCalledWith("user@example.com", "vip");

    addSpy.mockRestore();
  });

  it("reads email list files and removes tags", async () => {
    const removeSpy = spyOn(bento, "removeTag").mockResolvedValue(null);
    const addSpy = spyOn(bento, "addTag").mockResolvedValue(null);

    const filePath = join(tempDir, "emails.txt");
    await writeFile(filePath, "one@example.com\nTwo@example.com\n", "utf-8");

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "tag",
      "--file",
      filePath,
      "--remove",
      "churned",
      "--add",
      "retained",
      "--confirm",
    ]);

    expect(removeSpy).toHaveBeenCalledTimes(2);
    expect(addSpy).toHaveBeenCalledTimes(2);

    removeSpy.mockRestore();
    addSpy.mockRestore();
  });
});
