import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "bun";
import { Command } from "commander";

import { registerSequencesCommands } from "../../commands/sequences";
import { output } from "../../core/output";
import { bento } from "../../core/sdk";
import type { EmailTemplate, Sequence } from "../../types/sdk";

function runCLI(args: string[], options: { configPath?: string; input?: string } = {}) {
  const env: Record<string, string> = {
    ...process.env,
    BENTO_API_KEY: "test-api-key",
    BENTO_SITE_ID: "test-site-id",
  };

  if (options.configPath) {
    env.BENTO_CONFIG_PATH = options.configPath;
  }

  const result = spawnSync(["bun", "run", "src/cli.ts", ...args], {
    env,
    stdin: options.input ? Buffer.from(options.input) : undefined,
  });

  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSequencesCommands(program);
  return program;
}

function makeSequence(id: string, overrides: Partial<Sequence["attributes"]> = {}): Sequence {
  return {
    id,
    type: "sequences",
    attributes: {
      name: `Sequence ${id}`,
      created_at: "2025-01-01T00:00:00Z",
      email_templates: [{ id: 100, subject: "Welcome", stats: null }],
      ...overrides,
    },
  } as Sequence;
}

describe("bento sequences", () => {
  it("shows sequences help", () => {
    const result = runCLI(["sequences", "--help"]);
    expect(result.stdout).toContain("Manage email sequences");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("email");
  });

  it("shows sequences list help", () => {
    const result = runCLI(["sequences", "list", "--help"]);
    expect(result.stdout).toContain("List all sequences");
  });

  it("shows sequences email create help", () => {
    const result = runCLI(["sequences", "email", "create", "--help"]);
    expect(result.stdout).toContain("Create a new email in a sequence");
    expect(result.stdout).toContain("--subject");
    expect(result.stdout).toContain("--html");
    expect(result.stdout).toContain("--delay-interval");
    expect(result.stdout).toContain("--cc");
    expect(result.stdout).toContain("--bcc");
  });
});

describe("bento sequences list", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires authentication", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(["sequences", "list"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON error with --json flag when not authenticated", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(["sequences", "list", "--json"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("bento sequences email create", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires --subject option", () => {
    const result = runCLI(["sequences", "email", "create", "sequence_123", "--html", "<p>Hi</p>"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--subject");
    expect(result.exitCode).toBe(1);
  });

  it("requires --html option", () => {
    const result = runCLI(["sequences", "email", "create", "sequence_123", "--subject", "Welcome"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--html");
    expect(result.exitCode).toBe(1);
  });

  it("requires authentication", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(
      [
        "sequences",
        "email",
        "create",
        "sequence_123",
        "--subject",
        "Welcome",
        "--html",
        "<p>Hi</p>",
      ],
      { configPath }
    );

    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("requires --delay-interval when --delay-count is provided", () => {
    const result = runCLI([
      "sequences",
      "email",
      "create",
      "sequence_123",
      "--subject",
      "Welcome",
      "--html",
      "<p>Hi</p>",
      "--delay-count",
      "3",
    ]);

    expect(result.stderr).toContain("--delay-count requires --delay-interval");
    expect(result.exitCode).toBe(2);
  });

  it("rejects invalid --delay-interval", () => {
    const result = runCLI([
      "sequences",
      "email",
      "create",
      "sequence_123",
      "--subject",
      "Welcome",
      "--html",
      "<p>Hi</p>",
      "--delay-interval",
      "weeks",
    ]);

    expect(result.stderr).toContain("Invalid --delay-interval");
    expect(result.exitCode).toBe(2);
  });

  it("rejects non-positive --delay-count", () => {
    const result = runCLI([
      "sequences",
      "email",
      "create",
      "sequence_123",
      "--subject",
      "Welcome",
      "--html",
      "<p>Hi</p>",
      "--delay-interval",
      "days",
      "--delay-count",
      "0",
    ]);

    expect(result.stderr).toContain("--delay-count must be a positive integer");
    expect(result.exitCode).toBe(2);
  });
});

describe("sequences command rendering", () => {
  afterEach(() => {
    output.reset();
  });

  it("renders sequence rows in table mode", async () => {
    output.setInteractiveOverride(false);

    const sequenceSpy = spyOn(bento, "getSequences").mockResolvedValue([
      makeSequence("1"),
      makeSequence("2", { email_templates: [] }),
    ]);
    const tableSpy = spyOn(output, "table").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "sequences", "list"]);

    expect(sequenceSpy).toHaveBeenCalledTimes(1);
    expect(tableSpy).toHaveBeenCalledTimes(1);

    const rows = tableSpy.mock.calls[0][0] as Array<Record<string, string>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("1");
    expect(rows[0].name).toBe("Sequence 1");
    expect(rows[0].emails).toBe("1");
    expect(rows[1].emails).toBe("0");

    sequenceSpy.mockRestore();
    tableSpy.mockRestore();
  });

  it("renders sequence list JSON payload", async () => {
    output.setInteractiveOverride(false);
    output.setMode("json");

    const sequenceSpy = spyOn(bento, "getSequences").mockResolvedValue([makeSequence("1")]);
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "sequences", "list"]);

    expect(sequenceSpy).toHaveBeenCalledTimes(1);
    expect(jsonSpy).toHaveBeenCalledTimes(1);

    const payload = jsonSpy.mock.calls[0][0] as {
      data: unknown[];
      meta: { count: number };
    };
    expect(payload.data).toHaveLength(1);
    expect(payload.meta.count).toBe(1);

    sequenceSpy.mockRestore();
    jsonSpy.mockRestore();
  });

  it("passes sequence email create arguments to the SDK wrapper", async () => {
    output.setInteractiveOverride(false);

    const createSpy = spyOn(bento, "createSequenceEmail").mockResolvedValue({
      id: "template_123",
      type: "email_templates",
      attributes: {
        name: "Email",
        subject: "Welcome",
        html: "<p>Hi</p>",
        created_at: "2025-01-01T00:00:00Z",
        stats: null,
      },
    } as EmailTemplate);
    const successSpy = spyOn(output, "success").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "sequences",
      "email",
      "create",
      "sequence_123",
      "--subject",
      "Welcome",
      "--html",
      "<p>Hi</p>",
      "--delay-interval",
      "days",
      "--delay-count",
      "3",
      "--snippet",
      "Preview",
      "--editor",
      "visual",
      "--cc",
      "team@example.com",
      "--bcc",
      "audit@example.com",
      "--to",
      "person@example.com",
    ]);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith("sequence_123", {
      subject: "Welcome",
      html: "<p>Hi</p>",
      delay_interval: "days",
      delay_interval_count: 3,
      inbox_snippet: "Preview",
      editor_choice: "visual",
      cc: "team@example.com",
      bcc: "audit@example.com",
      to: "person@example.com",
    });
    expect(successSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created sequence email "Welcome"')
    );

    createSpy.mockRestore();
    successSpy.mockRestore();
  });
});
