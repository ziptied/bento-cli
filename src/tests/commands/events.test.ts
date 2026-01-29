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

describe("bento events", () => {
  it("shows events help with --help flag", () => {
    const result = runCLI(["events", "--help"]);
    expect(result.stdout).toContain("Track events");
    expect(result.stdout).toContain("track");
  });

  it("shows track help", () => {
    const result = runCLI(["events", "track", "--help"]);
    expect(result.stdout).toContain("Track a custom event");
    expect(result.stdout).toContain("--email");
    expect(result.stdout).toContain("--event");
    expect(result.stdout).toContain("--details");
  });
});

describe("bento events track", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires --email option", () => {
    const result = runCLI(["events", "track", "--event", "signup"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--email");
    expect(result.exitCode).toBe(1);
  });

  it("requires --event option", () => {
    const result = runCLI(["events", "track", "--email", "test@example.com"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--event");
    expect(result.exitCode).toBe(1);
  });

  it("requires authentication", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(
      ["events", "track", "--email", "test@example.com", "--event", "signup"],
      { configPath }
    );
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid JSON in --details", async () => {
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
        "events",
        "track",
        "--email",
        "test@example.com",
        "--event",
        "signup",
        "--details",
        "{invalid json}",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Invalid JSON");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON error with --json flag when invalid details", async () => {
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
        "events",
        "track",
        "--email",
        "test@example.com",
        "--event",
        "signup",
        "--details",
        "{bad}",
        "--json",
      ],
      { configPath }
    );
    // The error should contain information about invalid JSON
    const output = result.stdout || result.stderr;
    expect(output).toContain("Invalid JSON");
    expect(result.exitCode).toBe(1);
  });
});
