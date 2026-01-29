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

describe("bento fields", () => {
  it("shows fields help with --help flag", () => {
    const result = runCLI(["fields", "--help"]);
    expect(result.stdout).toContain("Manage custom fields");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("create");
  });

  it("shows list help", () => {
    const result = runCLI(["fields", "list", "--help"]);
    expect(result.stdout).toContain("List all custom fields");
  });

  it("shows create help", () => {
    const result = runCLI(["fields", "create", "--help"]);
    expect(result.stdout).toContain("Create a new custom field");
    expect(result.stdout).toContain("<key>");
  });
});

describe("bento fields list", () => {
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

    const result = runCLI(["fields", "list"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON with --json flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["fields", "list", "--json"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("bento fields create", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires a field key argument", () => {
    const result = runCLI(["fields", "create"]);
    expect(result.stderr).toContain("missing required argument");
    expect(result.exitCode).toBe(1);
  });

  it("rejects empty field key", async () => {
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

    const result = runCLI(["fields", "create", "   "], { configPath });
    expect(result.stderr).toContain("Field key cannot be empty");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid field key format - starts with number", async () => {
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

    const result = runCLI(["fields", "create", "123field"], { configPath });
    expect(result.stderr).toContain("Field key must start with a letter");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid field key format - contains special characters", async () => {
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

    const result = runCLI(["fields", "create", "field-name"], { configPath });
    expect(result.stderr).toContain("Field key must start with a letter");
    expect(result.exitCode).toBe(1);
  });

  it("accepts valid snake_case field key", async () => {
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

    // This will fail because credentials are invalid, but should pass validation
    const result = runCLI(["fields", "create", "company_name"], { configPath });
    // Should fail at API call, not at validation
    expect(result.stderr).not.toContain("Field key must start with a letter");
  });

  it("accepts valid camelCase field key", async () => {
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

    // This will fail because credentials are invalid, but should pass validation
    const result = runCLI(["fields", "create", "companyName"], { configPath });
    // Should fail at API call, not at validation
    expect(result.stderr).not.toContain("Field key must start with a letter");
  });

  it("requires authentication", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["fields", "create", "company"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});
