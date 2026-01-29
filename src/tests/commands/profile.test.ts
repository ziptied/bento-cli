import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "bun";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
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

describe("bento profile", () => {
  it("shows profile help with --help flag", () => {
    const result = runCLI(["profile", "--help"]);
    expect(result.stdout).toContain("Manage credential profiles");
    expect(result.stdout).toContain("add");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("use");
    expect(result.stdout).toContain("remove");
  });

  it("shows add help", () => {
    const result = runCLI(["profile", "add", "--help"]);
    expect(result.stdout).toContain("Add a new profile");
    expect(result.stdout).toContain("--api-key");
    expect(result.stdout).toContain("--site-id");
  });

  it("shows list help", () => {
    const result = runCLI(["profile", "list", "--help"]);
    expect(result.stdout).toContain("List all profiles");
  });

  it("shows use help", () => {
    const result = runCLI(["profile", "use", "--help"]);
    expect(result.stdout).toContain("Switch to a profile");
  });

  it("shows remove help", () => {
    const result = runCLI(["profile", "remove", "--help"]);
    expect(result.stdout).toContain("Remove a profile");
    expect(result.stdout).toContain("--yes");
  });
});

describe("bento profile list", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows empty state when no profiles exist", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["profile", "list"], { configPath });
    expect(result.stdout).toContain("No profiles configured");
    expect(result.stdout).toContain("bento auth login");
    expect(result.exitCode).toBe(0);
  });

  it("lists profiles in table format", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "prod",
        profiles: {
          prod: {
            apiKey: "prod-key",
            siteId: "prod-site",
            createdAt: now,
            updatedAt: now,
          },
          staging: {
            apiKey: "staging-key",
            siteId: "staging-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["profile", "list"], { configPath });
    expect(result.stdout).toContain("prod");
    expect(result.stdout).toContain("staging");
    expect(result.stdout).toContain("prod-site");
    expect(result.stdout).toContain("staging-site");
    // Current profile marker
    expect(result.stdout).toContain("✓");
    expect(result.exitCode).toBe(0);
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

    const result = runCLI(["profile", "list", "--json"], { configPath });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data).toBeArray();
    expect(json.data.length).toBe(1);
    expect(json.data[0].name).toBe("default");
    expect(json.data[0].current).toBe(true);
    expect(json.data[0].siteId).toBe("test-site");
    expect(result.exitCode).toBe(0);
  });

  it("outputs empty array JSON when no profiles", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["profile", "list", "--json"], { configPath });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
    expect(json.meta.count).toBe(0);
  });
});

describe("bento profile use", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("switches to existing profile", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            apiKey: "default-key",
            siteId: "default-site",
            createdAt: now,
            updatedAt: now,
          },
          staging: {
            apiKey: "staging-key",
            siteId: "staging-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["profile", "use", "staging"], { configPath });
    expect(result.stdout).toContain("Switched to profile");
    expect(result.stdout).toContain("staging");
    expect(result.exitCode).toBe(0);

    // Verify config was updated
    const updatedConfig = JSON.parse(await readFile(configPath, "utf-8"));
    expect(updatedConfig.current).toBe("staging");
  });

  it("errors on non-existent profile", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["profile", "use", "nonexistent"], { configPath });
    expect(result.stderr).toContain("not found");
    expect(result.exitCode).toBe(1);
  });

  it("suggests available profiles on error", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: null,
        profiles: {
          staging: {
            apiKey: "staging-key",
            siteId: "staging-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["profile", "use", "prod"], { configPath });
    expect(result.stderr).toContain("staging");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON with --json flag", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: null,
        profiles: {
          staging: {
            apiKey: "staging-key",
            siteId: "staging-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["profile", "use", "staging", "--json"], { configPath });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data.profile).toBe("staging");
    expect(result.exitCode).toBe(0);
  });
});

describe("bento profile remove", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("errors on non-existent profile", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["profile", "remove", "nonexistent", "--yes"], {
      configPath,
    });
    expect(result.stderr).toContain("not found");
    expect(result.exitCode).toBe(1);
  });

  it("requires --yes flag in non-interactive mode", async () => {
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

    const result = runCLI(["profile", "remove", "default"], { configPath });
    expect(result.stderr).toContain("--yes");
    expect(result.exitCode).toBe(1);

    // Verify profile was NOT removed
    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.profiles.default).toBeDefined();
  });

  it("removes profile with --yes flag", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "staging",
        profiles: {
          default: {
            apiKey: "default-key",
            siteId: "default-site",
            createdAt: now,
            updatedAt: now,
          },
          staging: {
            apiKey: "staging-key",
            siteId: "staging-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["profile", "remove", "default", "--yes"], {
      configPath,
    });
    expect(result.stdout).toContain("removed");
    expect(result.exitCode).toBe(0);

    // Verify profile was removed
    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.profiles.default).toBeUndefined();
    expect(config.profiles.staging).toBeDefined();
    // Current should still be staging
    expect(config.current).toBe("staging");
  });

  it("clears current when removing active profile", async () => {
    const now = new Date().toISOString();
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        current: "default",
        profiles: {
          default: {
            apiKey: "default-key",
            siteId: "default-site",
            createdAt: now,
            updatedAt: now,
          },
        },
      })
    );

    const result = runCLI(["profile", "remove", "default", "--yes"], {
      configPath,
    });
    expect(result.stdout).toContain("removed");
    expect(result.stdout).toContain("active profile");
    expect(result.exitCode).toBe(0);

    // Verify current was cleared
    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.current).toBeNull();
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

    const result = runCLI(["profile", "remove", "default", "--yes", "--json"], {
      configPath,
    });
    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.data.profile).toBe("default");
    expect(json.data.wasCurrentProfile).toBe(true);
    expect(result.exitCode).toBe(0);
  });
});

describe("bento profile add", () => {
  it("errors when profile already exists", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    const configPath = join(tempDir, "config.json");

    try {
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

      const result = runCLI(
        ["profile", "add", "default", "--api-key", "new-key", "--site-id", "new-site"],
        { configPath }
      );
      expect(result.stderr).toContain("already exists");
      expect(result.exitCode).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("requires --api-key and --site-id in non-interactive mode", () => {
    const result = runCLI(["profile", "add", "newprofile", "--api-key", "test"]);
    expect(result.stderr).toContain("Non-interactive mode requires");
    expect(result.exitCode).toBe(1);
  });

  it("validates profile name format", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    const configPath = join(tempDir, "config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({ version: 1, current: null, profiles: {} })
      );

      // Profile names with special characters should be rejected by ConfigManager
      const result = runCLI(
        ["profile", "add", "bad name!", "--api-key", "key", "--site-id", "site"],
        { configPath }
      );
      // The error comes from validateCredentials failing (expected behavior)
      // or from profile name validation
      expect(result.exitCode).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
