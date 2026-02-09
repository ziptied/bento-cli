import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import { spawnSync } from "bun";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registerBroadcastsCommands } from "../../commands/broadcasts";
import { output } from "../../core/output";
import { bento } from "../../core/sdk";
import type { Broadcast } from "../../types/sdk";

/**
 * Helper to run CLI commands with a custom config path
 */
function runCLI(
  args: string[],
  options: { configPath?: string; input?: string } = {}
) {
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
  registerBroadcastsCommands(program);
  return program;
}

function makeBroadcast(id: string, overrides: Partial<Broadcast["attributes"]> = {}): Broadcast {
  return {
    id,
    type: "broadcast",
    attributes: {
      name: `Broadcast ${id}`,
      subject: `Subject ${id}`,
      template: { subject: `Subject ${id}` },
      stats: { recipients: 5, total_opens: 2, total_clicks: 1 },
      created_at: "2025-01-01T00:00:00Z",
      ...overrides,
    },
  } as Broadcast;
}

describe("bento broadcasts", () => {
  it("shows broadcasts help with --help flag", () => {
    const result = runCLI(["broadcasts", "--help"]);
    expect(result.stdout).toContain("Manage email broadcasts");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("create");
  });

  it("shows list help", () => {
    const result = runCLI(["broadcasts", "list", "--help"]);
    expect(result.stdout).toContain("List broadcasts");
    expect(result.stdout).toContain("--page");
    expect(result.stdout).toContain("--per-page");
  });

  it("shows create help", () => {
    const result = runCLI(["broadcasts", "create", "--help"]);
    expect(result.stdout).toContain("Create a new broadcast draft");
    expect(result.stdout).toContain("--name");
    expect(result.stdout).toContain("--subject");
    expect(result.stdout).toContain("--content");
    expect(result.stdout).toContain("--type");
    expect(result.stdout).toContain("--from-name");
    expect(result.stdout).toContain("--from-email");
    expect(result.stdout).toContain("--include-tags");
    expect(result.stdout).toContain("--exclude-tags");
    expect(result.stdout).toContain("--batch-size");
  });
});

describe("bento broadcasts list", () => {
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
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["broadcasts", "list"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON error with --json flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["broadcasts", "list", "--json"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("bento broadcasts create", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires --name option", () => {
    const result = runCLI(["broadcasts", "create", "--subject", "Test Subject"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--name");
    expect(result.exitCode).toBe(1);
  });

  it("requires --subject option", () => {
    const result = runCLI(["broadcasts", "create", "--name", "Test Broadcast"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--subject");
    expect(result.exitCode).toBe(1);
  });

  it("requires authentication", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(
      [
        "broadcasts",
        "create",
        "--name",
        "Test Broadcast",
        "--subject",
        "Test Subject",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid type option", async () => {
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            publishableKey: "test-pub-key",
            secretKey: "test-secret-key",
            siteUuid: "test-site-uuid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      })
    );

    const result = runCLI(
      [
        "broadcasts",
        "create",
        "--name",
        "Test",
        "--subject",
        "Test Subject",
        "--type",
        "invalid_type",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Invalid type");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid batch size", async () => {
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            publishableKey: "test-pub-key",
            secretKey: "test-secret-key",
            siteUuid: "test-site-uuid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      })
    );

    const result = runCLI(
      [
        "broadcasts",
        "create",
        "--name",
        "Test",
        "--subject",
        "Test Subject",
        "--batch-size",
        "0",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Batch size must be a positive number");
    expect(result.exitCode).toBe(1);
  });

  it("rejects non-numeric batch size", async () => {
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            publishableKey: "test-pub-key",
            secretKey: "test-secret-key",
            siteUuid: "test-site-uuid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      })
    );

    const result = runCLI(
      [
        "broadcasts",
        "create",
        "--name",
        "Test",
        "--subject",
        "Test Subject",
        "--batch-size",
        "abc",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Batch size must be a positive number");
    expect(result.exitCode).toBe(1);
  });
});

describe("broadcasts list pagination", () => {
  afterEach(() => {
    output.reset();
  });

  it("limits the output to the requested per-page count", async () => {
    output.setInteractiveOverride(false);

    const listSpy = spyOn(bento, "getBroadcasts").mockResolvedValue([
      makeBroadcast("1"),
      makeBroadcast("2"),
      makeBroadcast("3"),
      makeBroadcast("4"),
    ]);
    const tableSpy = spyOn(output, "table").mockImplementation(() => {});
    const infoSpy = spyOn(output, "info").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "broadcasts", "list", "--per-page", "2"]);

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(tableSpy).toHaveBeenCalledTimes(1);
    const rows = tableSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Broadcast 1");
    expect(rows[1].name).toBe("Broadcast 2");
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("showing 2"));

    listSpy.mockRestore();
    tableSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("limits JSON output to the requested per-page count", async () => {
    output.setInteractiveOverride(false);
    output.setMode("json");

    const listSpy = spyOn(bento, "getBroadcasts").mockResolvedValue([
      makeBroadcast("1"),
      makeBroadcast("2"),
    ]);
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "broadcasts",
      "list",
      "--per-page",
      "1",
    ]);

    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const payload = jsonSpy.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
      meta: { count: number; total: number; page: number; pageSize: number; hasMore: boolean };
    };
    expect(payload.data).toHaveLength(1);
    expect(payload.meta.count).toBe(1);
    expect(payload.meta.total).toBe(2);
    expect(payload.meta.page).toBe(1);
    expect(payload.meta.pageSize).toBe(1);
    expect(payload.meta.hasMore).toBe(true);

    listSpy.mockRestore();
    jsonSpy.mockRestore();
  });

  it("shows the correct rows for later pages", async () => {
    output.setInteractiveOverride(false);

    const listSpy = spyOn(bento, "getBroadcasts").mockResolvedValue([
      makeBroadcast("1"),
      makeBroadcast("2"),
      makeBroadcast("3"),
      makeBroadcast("4"),
    ]);
    const tableSpy = spyOn(output, "table").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "broadcasts",
      "list",
      "--per-page",
      "2",
      "--page",
      "2",
    ]);

    const rows = tableSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Broadcast 3");
    expect(rows[1].name).toBe("Broadcast 4");

    listSpy.mockRestore();
    tableSpy.mockRestore();
  });
});
