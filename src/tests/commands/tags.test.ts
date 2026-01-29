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

describe("bento tags", () => {
  it("shows tags help with --help flag", () => {
    const result = runCLI(["tags", "--help"]);
    expect(result.stdout).toContain("Manage tags");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("create");
    expect(result.stdout).toContain("delete");
  });

  it("shows list help", () => {
    const result = runCLI(["tags", "list", "--help"]);
    expect(result.stdout).toContain("List all tags");
  });

  it("shows create help", () => {
    const result = runCLI(["tags", "create", "--help"]);
    expect(result.stdout).toContain("Create a new tag");
    expect(result.stdout).toContain("<name>");
  });

  it("shows delete help", () => {
    const result = runCLI(["tags", "delete", "--help"]);
    expect(result.stdout).toContain("Delete a tag");
    expect(result.stdout).toContain("--confirm");
    expect(result.stdout).toContain("<name>");
  });
});

describe("bento tags list", () => {
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

    const result = runCLI(["tags", "list"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON with --json flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["tags", "list", "--json"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("bento tags create", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires a tag name argument", () => {
    const result = runCLI(["tags", "create"]);
    expect(result.stderr).toContain("missing required argument");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty tag name", async () => {
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

    const result = runCLI(["tags", "create", "   "], { configPath });
    expect(result.stderr).toContain("Tag name cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  it("requires authentication", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["tags", "create", "newsletter"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("bento tags delete", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires a tag name argument", () => {
    const result = runCLI(["tags", "delete"]);
    expect(result.stderr).toContain("missing required argument");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty tag name", async () => {
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

    // Use --confirm to skip prompt
    const result = runCLI(["tags", "delete", "   ", "--confirm"], { configPath });
    expect(result.stderr).toContain("Tag name cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  it("requires confirmation without --confirm flag (non-interactive fails)", async () => {
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

    const result = runCLI(["tags", "delete", "old-tag"], { configPath });
    // Should warn about non-interactive mode
    expect(result.stderr).toContain("Cannot run");
    expect(result.stderr).toContain("--confirm");
  });

  it("shows API limitation message with --confirm flag", async () => {
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

    const result = runCLI(["tags", "delete", "old-tag", "--confirm"], { configPath });
    expect(result.stderr).toContain("not currently supported");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON when cancelled with --json flag (non-interactive)", async () => {
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

    const result = runCLI(["tags", "delete", "old-tag", "--json"], { configPath });
    const output = result.stdout || result.stderr;
    // Non-interactive mode should fail or return JSON response
    expect(output).toContain("Cannot run");
  });
});
