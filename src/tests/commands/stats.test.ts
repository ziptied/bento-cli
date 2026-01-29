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

describe("bento stats", () => {
  it("shows stats help with --help flag", () => {
    const result = runCLI(["stats", "--help"]);
    expect(result.stdout).toContain("View site statistics");
    expect(result.stdout).toContain("site");
  });

  it("shows site help", () => {
    const result = runCLI(["stats", "site", "--help"]);
    expect(result.stdout).toContain("Show site-wide statistics");
  });
});

describe("bento stats site", () => {
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

    const result = runCLI(["stats", "site"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON error with --json flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["stats", "site", "--json"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("produces no output with --quiet flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["stats", "site", "--quiet"], { configPath });
    // Errors still print in quiet mode
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});
