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

function makeSequence(overrides: Partial<Sequence["attributes"]> = {}): Sequence {
  return {
    id: "seq_123",
    type: "sequence",
    attributes: {
      name: "Welcome",
      created_at: "2025-01-01T00:00:00Z",
      email_templates: [{ id: 1001, subject: "Welcome", stats: null }],
      ...overrides,
    },
  } as Sequence;
}

function makeTemplate(id = 1002): EmailTemplate {
  return {
    id,
    type: "email_template",
    attributes: {
      subject: "Hello",
      html: "<p>Hello</p>",
    },
  } as EmailTemplate;
}

describe("bento sequences", () => {
  it("shows sequences help with --help flag", () => {
    const result = runCLI(["sequences", "--help"]);
    expect(result.stdout).toContain("Manage email sequences");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("create-email");
    expect(result.stdout).toContain("update-email");
  });

  it("shows create-email help", () => {
    const result = runCLI(["sequences", "create-email", "--help"]);
    expect(result.stdout).toContain("Append a new email template to a sequence");
    expect(result.stdout).toContain("--sequence-id");
    expect(result.stdout).toContain("--sequence-name");
    expect(result.stdout).toContain("--subject");
    expect(result.stdout).toContain("--html");
    expect(result.stdout).toContain("--html-file");
    expect(result.stdout).toContain("--delay-interval");
    expect(result.stdout).toContain("--delay-count");
  });

  it("shows update-email help", () => {
    const result = runCLI(["sequences", "update-email", "--help"]);
    expect(result.stdout).toContain("Patch an existing sequence email template");
    expect(result.stdout).toContain("--template-id");
    expect(result.stdout).toContain("--subject");
    expect(result.stdout).toContain("--html");
    expect(result.stdout).toContain("--html-file");
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
});

describe("sequences create-email validation", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires exactly one of --html or --html-file", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(
      ["sequences", "create-email", "--sequence-id", "sequence_1", "--subject", "Hello"],
      { configPath }
    );
    expect(result.stderr).toContain("Provide exactly one of --html or --html-file");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid delay interval", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(
      [
        "sequences",
        "create-email",
        "--sequence-id",
        "sequence_1",
        "--subject",
        "Hello",
        "--html",
        "<p>Hello</p>",
        "--delay-interval",
        "weeks",
        "--delay-count",
        "2",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("--delay-interval must be one of");
    expect(result.exitCode).toBe(1);
  });
});

describe("sequences update-email validation", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires --template-id option", () => {
    const result = runCLI(["sequences", "update-email", "--subject", "Hello"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--template-id");
    expect(result.exitCode).toBe(1);
  });

  it("requires at least one update field", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(["sequences", "update-email", "--template-id", "12345"], { configPath });
    expect(result.stderr).toContain(
      "At least one of --subject, --html, or --html-file must be provided"
    );
    expect(result.exitCode).toBe(1);
  });

  it("rejects when both --html and --html-file are provided", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const htmlFile = join(tempDir, "email.html");
    await writeFile(htmlFile, "<p>Test</p>");

    const result = runCLI(
      [
        "sequences",
        "update-email",
        "--template-id",
        "12345",
        "--html",
        "<p>Inline</p>",
        "--html-file",
        htmlFile,
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Provide exactly one of --html or --html-file");
    expect(result.exitCode).toBe(1);
  });

  it("requires authentication", async () => {
    await writeFile(configPath, JSON.stringify({ version: 1, current: null, profiles: {} }));

    const result = runCLI(
      ["sequences", "update-email", "--template-id", "12345", "--subject", "Updated subject"],
      { configPath }
    );
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("sequences create-email success", () => {
  afterEach(() => {
    output.reset();
  });

  it("creates a sequence email with list response ID and wrapped payload fields", async () => {
    output.setInteractiveOverride(false);

    const resolveSpy = spyOn(bento, "resolveSequenceIdForEmail").mockResolvedValue("123");
    const createSpy = spyOn(bento, "createSequenceEmail").mockResolvedValue(makeTemplate(4321));
    const successSpy = spyOn(output, "success").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "sequences",
      "create-email",
      "--sequence-id",
      "123",
      "--subject",
      "Welcome",
      "--html",
      "<p>Welcome</p>",
      "--delay-interval",
      "days",
      "--delay-count",
      "2",
    ]);

    expect(resolveSpy).toHaveBeenCalledWith({
      sequenceId: "123",
      sequenceName: undefined,
    });
    expect(createSpy).toHaveBeenCalledWith("123", {
      subject: "Welcome",
      html: "<p>Welcome</p>",
      inboxSnippet: undefined,
      delayInterval: "days",
      delayCount: 2,
      editorChoice: undefined,
      cc: undefined,
      bcc: undefined,
      to: undefined,
    });
    expect(successSpy).toHaveBeenCalledWith("Created email 4321 in sequence 123");

    resolveSpy.mockRestore();
    createSpy.mockRestore();
    successSpy.mockRestore();
  });

  it("resolves sequence name to sequence ID before create", async () => {
    output.setInteractiveOverride(false);

    const resolveSpy = spyOn(bento, "resolveSequenceIdForEmail").mockResolvedValue("123");
    const createSpy = spyOn(bento, "createSequenceEmail").mockResolvedValue(makeTemplate());
    const successSpy = spyOn(output, "success").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "sequences",
      "create-email",
      "--sequence-name",
      "Welcome Flow",
      "--subject",
      "Day 1",
      "--html",
      "<p>Day 1</p>",
    ]);

    expect(resolveSpy).toHaveBeenCalledWith({
      sequenceId: undefined,
      sequenceName: "Welcome Flow",
    });
    expect(createSpy).toHaveBeenCalledWith(
      "123",
      expect.objectContaining({ subject: "Day 1", html: "<p>Day 1</p>" })
    );

    resolveSpy.mockRestore();
    createSpy.mockRestore();
    successSpy.mockRestore();
  });
});

describe("sequences update-email success", () => {
  afterEach(() => {
    output.reset();
  });

  it("patches an existing template by numeric template ID", async () => {
    output.setInteractiveOverride(false);

    const updateSpy = spyOn(bento, "updateSequenceEmail").mockResolvedValue(makeTemplate(12345));
    const successSpy = spyOn(output, "success").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "sequences",
      "update-email",
      "--template-id",
      "12345",
      "--subject",
      "Updated subject",
      "--html",
      "<p>Updated</p>",
    ]);

    expect(updateSpy).toHaveBeenCalledWith("12345", {
      subject: "Updated subject",
      html: "<p>Updated</p>",
    });
    expect(successSpy).toHaveBeenCalledWith("Updated email template 12345");

    updateSpy.mockRestore();
    successSpy.mockRestore();
  });
});

describe("sequences list output", () => {
  afterEach(() => {
    output.reset();
  });

  it("shows sequence IDs in the list table", async () => {
    output.setInteractiveOverride(false);

    const listSpy = spyOn(bento, "getSequences").mockResolvedValue([
      makeSequence({ name: "Welcome" }),
    ]);
    const tableSpy = spyOn(output, "table").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "sequences", "list"]);

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(tableSpy).toHaveBeenCalledTimes(1);
    const rows = tableSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].sequenceId).toBe("seq_123");

    listSpy.mockRestore();
    tableSpy.mockRestore();
  });
});
