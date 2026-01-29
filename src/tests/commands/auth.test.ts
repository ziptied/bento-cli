import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { spawnSync } from "bun";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
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
    // Ensure we don't accidentally use real credentials
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

describe("bento auth", () => {
  it("shows auth help with --help flag", () => {
    const result = runCLI(["auth", "--help"]);
    expect(result.stdout).toContain("Authentication management");
    expect(result.stdout).toContain("login");
    expect(result.stdout).toContain("logout");
    expect(result.stdout).toContain("status");
  });

  it("shows login help", () => {
    const result = runCLI(["auth", "login", "--help"]);
    expect(result.stdout).toContain("Authenticate with Bento API");
    expect(result.stdout).toContain("--profile");
    expect(result.stdout).toContain("--api-key");
    expect(result.stdout).toContain("--site-id");
  });

  it("shows logout help", () => {
    const result = runCLI(["auth", "logout", "--help"]);
    expect(result.stdout).toContain("Clear current authentication");
  });

  it("shows status help", () => {
    const result = runCLI(["auth", "status", "--help"]);
    expect(result.stdout).toContain("Show current authentication status");
  });
});

describe("bento auth status", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows not authenticated when no profile exists", async () => {
    // Create empty config
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["auth", "status"], { configPath });
    expect(result.stdout).toContain("Not authenticated");
    expect(result.stdout).toContain("bento auth login");
    expect(result.exitCode).toBe(0);
  });

  it("shows profile info when authenticated", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            apiKey: "test-api-key-12345678",
            siteId: "test-site-id",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["auth", "status"], { configPath });
    expect(result.stdout).toContain("default");
    expect(result.stdout).toContain("test-site-id");
    // API key should be masked
    expect(result.stdout).toContain("test-api");
    expect(result.stdout).not.toContain("test-api-key-12345678");
    expect(result.exitCode).toBe(0);
  });

  it("outputs JSON with --json flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["auth", "status", "--json"], { configPath });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data.authenticated).toBe(false);
    expect(result.exitCode).toBe(0);
  });

  it("outputs JSON with --json flag when authenticated", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "staging",
        profiles: {
          staging: {
            apiKey: "staging-api-key-12345678",
            siteId: "staging-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["auth", "status", "--json"], { configPath });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data.authenticated).toBe(true);
    expect(json.data.profile).toBe("staging");
    expect(json.data.siteId).toBe("staging-site");
    expect(result.exitCode).toBe(0);
  });
});

describe("bento auth logout", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("warns when no profile is active", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["auth", "logout"], { configPath });
    // Warning goes to stderr
    expect(result.stderr).toContain("No active profile");
    expect(result.exitCode).toBe(0);
  });

  it("removes the current profile on logout", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            apiKey: "test-key",
            siteId: "test-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["auth", "logout"], { configPath });
    expect(result.stdout).toContain("Logged out");
    expect(result.exitCode).toBe(0);

    // Verify config was updated
    const updatedConfig = JSON.parse(await readFile(configPath, "utf-8"));
    expect(updatedConfig.current).toBeNull();
    expect(updatedConfig.profiles.default).toBeUndefined();
  });

  it("outputs JSON with --json flag", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            apiKey: "test-key",
            siteId: "test-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["auth", "logout", "--json"], { configPath });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data.loggedOut).toBe(true);
    expect(json.data.profile).toBe("default");
    expect(result.exitCode).toBe(0);
  });
});

describe("bento auth login", () => {
  it("requires --api-key and --site-id in non-interactive mode", () => {
    const result = runCLI(["auth", "login", "--api-key", "test"]);
    expect(result.stderr).toContain("Non-interactive mode requires");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty API key", () => {
    const result = runCLI(["auth", "login", "--api-key", "", "--site-id", "test"]);
    expect(result.stderr).toContain("API key cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty Site ID", () => {
    const result = runCLI(["auth", "login", "--api-key", "test", "--site-id", ""]);
    expect(result.stderr).toContain("Site ID cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  // Note: Full login tests with credential validation require mocking the SDK
  // which would be done in integration tests or with a more sophisticated mock setup
});
