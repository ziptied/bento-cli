import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "bun";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
