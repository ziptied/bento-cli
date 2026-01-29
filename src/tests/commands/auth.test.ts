import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "bun";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { maskApiKey } from "../../commands/auth";

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

describe("auth maskApiKey", () => {
  it("returns all asterisks for short keys", () => {
    expect(maskApiKey("abc")).toBe("***");
    expect(maskApiKey("a")).toBe("*");
    expect(maskApiKey("")).toBe("");
  });

  it("masks medium keys with first four characters", () => {
    expect(maskApiKey("abcdefgh")).toBe("abcd****");
  });

  it("shows both ends for long keys", () => {
    expect(maskApiKey("abcdefghijklmno")).toBe("abcdefgh...lmno");
  });
});

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
    expect(result.stdout).toContain("--publishable-key");
    expect(result.stdout).toContain("--secret-key");
    expect(result.stdout).toContain("--site-uuid");
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
            publishableKey: "pub-key-12345678",
            secretKey: "secret-key-12345678",
            siteUuid: "test-site-uuid",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["auth", "status"], { configPath });
    expect(result.stdout).toContain("default");
    expect(result.stdout).toContain("test-site-uuid");
    // Keys should be masked
    expect(result.stdout).toContain("pub-key-");
    expect(result.stdout).not.toContain("pub-key-12345678");
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
            publishableKey: "staging-pub-key-12345678",
            secretKey: "staging-secret-key-12345678",
            siteUuid: "staging-site-uuid",
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
    expect(json.data.siteUuid).toBe("staging-site-uuid");
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
            publishableKey: "test-pub-key",
            secretKey: "test-secret-key",
            siteUuid: "test-site-uuid",
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
            publishableKey: "test-pub-key",
            secretKey: "test-secret-key",
            siteUuid: "test-site-uuid",
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
  it("requires all credentials in non-interactive mode", () => {
    const result = runCLI(["auth", "login", "--publishable-key", "test"]);
    expect(result.stderr).toContain("Non-interactive mode requires");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty publishable key", () => {
    const result = runCLI([
      "auth",
      "login",
      "--publishable-key",
      "",
      "--secret-key",
      "test",
      "--site-uuid",
      "test",
    ]);
    expect(result.stderr).toContain("Publishable key cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty secret key", () => {
    const result = runCLI([
      "auth",
      "login",
      "--publishable-key",
      "test",
      "--secret-key",
      "",
      "--site-uuid",
      "test",
    ]);
    expect(result.stderr).toContain("Secret key cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty site UUID", () => {
    const result = runCLI([
      "auth",
      "login",
      "--publishable-key",
      "test",
      "--secret-key",
      "test",
      "--site-uuid",
      "",
    ]);
    expect(result.stderr).toContain("Site UUID cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  // Note: Full login tests with credential validation require mocking the SDK
  // which would be done in integration tests or with a more sophisticated mock setup
});
