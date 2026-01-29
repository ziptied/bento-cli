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

async function createCsv(name: string, rows: string[]): Promise<string> {
  const file = join(tempDir, name);
  await writeFile(file, rows.join("\n"), "utf-8");
  return file;
}

describe("subscribers import command", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-subs-import-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    output.reset();
  });

  it("parses CSV rows and sends them to the SDK", async () => {
    const csvPath = await createCsv("subs.csv", [
      "email,name,plan",
      "user@example.com,Test User,gold",
    ]);

    const importSpy = spyOn(bento, "importSubscribers").mockResolvedValue({ imported: 1 });
    const successSpy = spyOn(output, "success").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "subscribers", "import", csvPath, "--confirm"]);

    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(importSpy.mock.calls[0][0]).toEqual({
      subscribers: [
        {
          email: "user@example.com",
          name: "Test User",
          plan: "gold",
        },
      ],
    });
    expect(successSpy).toHaveBeenCalledWith("Imported 1 subscriber(s).");

    importSpy.mockRestore();
    successSpy.mockRestore();
  });

  it("honors --dry-run by skipping SDK execution", async () => {
    const csvPath = await createCsv("dry-run.csv", ["email", "user@example.com"]);

    const importSpy = spyOn(bento, "importSubscribers").mockResolvedValue({ imported: 1 });

    const program = buildProgram();
    await program.parseAsync(["node", "test", "subscribers", "import", csvPath, "--dry-run"]);

    expect(importSpy).not.toHaveBeenCalled();

    importSpy.mockRestore();
  });
});
