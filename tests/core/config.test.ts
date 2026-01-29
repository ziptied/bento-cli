import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rm, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigManager, ConfigError } from "../../src/core/config";
import { DEFAULT_CONFIG } from "../../src/types/config";

// Use crypto for guaranteed unique IDs
function uniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

describe("ConfigManager", () => {
  let testDir: string;
  let configPath: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `bento-test-${uniqueId()}`);
    await mkdir(testDir, { recursive: true });
    configPath = join(testDir, "config.json");
    // Create fresh ConfigManager for each test (important for isolation)
    configManager = new ConfigManager(configPath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("load()", () => {
    it("creates default config on first load", async () => {
      const config = await configManager.load();

      expect(config.version).toBe(1);
      expect(config.current).toBeNull();
      expect(config.profiles).toEqual({});
    });

    it("persists default config to disk on first load", async () => {
      await configManager.load();

      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.version).toBe(1);
      expect(parsed.current).toBeNull();
      expect(parsed.profiles).toEqual({});
    });

    it("loads existing config from disk", async () => {
      const existingConfig = {
        version: 1,
        current: "prod",
        profiles: {
          prod: {
            publishableKey: "prod-pub-key",
            secretKey: "prod-secret-key",
            siteUuid: "prod-site-uuid",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        },
      };
      await mkdir(testDir, { recursive: true });
      await writeFile(configPath, JSON.stringify(existingConfig));

      const config = await configManager.load();

      expect(config.version).toBe(1);
      expect(config.current).toBe("prod");
      expect(config.profiles.prod.publishableKey).toBe("prod-pub-key");
    });

    it("caches config after first load", async () => {
      const config1 = await configManager.load();
      config1.current = "modified";

      const config2 = await configManager.load();

      // Should return same cached object
      expect(config2.current).toBe("modified");
    });

    it("throws ConfigError for invalid JSON", async () => {
      await writeFile(configPath, "{ invalid json }");

      await expect(configManager.load()).rejects.toThrow(ConfigError);
      await expect(configManager.load()).rejects.toMatchObject({
        code: "INVALID_JSON",
      });
    });

    it("throws ConfigError for unsupported version", async () => {
      await writeFile(configPath, JSON.stringify({ version: 99 }));

      await expect(configManager.load()).rejects.toThrow(ConfigError);
      await expect(configManager.load()).rejects.toMatchObject({
        code: "UNSUPPORTED_VERSION",
      });
    });

    it("throws ConfigError when config is not an object", async () => {
      await writeFile(configPath, JSON.stringify("not an object"));

      await expect(configManager.load()).rejects.toThrow(ConfigError);
      await expect(configManager.load()).rejects.toMatchObject({
        code: "INVALID_SCHEMA",
      });
    });

    it("throws ConfigError for profile with missing credentials", async () => {
      const invalidConfig = {
        version: 1,
        current: null,
        profiles: {
          bad: { siteUuid: "site" },
        },
      };
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(configManager.load()).rejects.toThrow(ConfigError);
      await expect(configManager.load()).rejects.toMatchObject({
        code: "INVALID_SCHEMA",
      });
    });

    it("throws ConfigError for profile with incomplete credentials", async () => {
      const invalidConfig = {
        version: 1,
        current: null,
        profiles: {
          bad: { publishableKey: "key", secretKey: "secret" }, // missing siteUuid
        },
      };
      await writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(configManager.load()).rejects.toThrow(ConfigError);
      await expect(configManager.load()).rejects.toMatchObject({
        code: "INVALID_SCHEMA",
      });
    });

    it("backfills timestamps for profiles missing them", async () => {
      const config = {
        version: 1,
        current: "prod",
        profiles: {
          prod: { publishableKey: "key", secretKey: "secret", siteUuid: "site" },
        },
      };
      await writeFile(configPath, JSON.stringify(config));

      const loadedConfig = await configManager.load();
      const profile = loadedConfig.profiles.prod;

      expect(typeof profile.createdAt).toBe("string");
      expect(typeof profile.updatedAt).toBe("string");
      expect(Number.isNaN(Date.parse(profile.createdAt))).toBeFalse();
      expect(Number.isNaN(Date.parse(profile.updatedAt))).toBeFalse();
      expect(profile.createdAt).toBe(profile.updatedAt);
    });

    it("migrates legacy format (apiKey, siteId) to new format", async () => {
      const legacyConfig = {
        version: 1,
        current: "prod",
        profiles: {
          prod: { apiKey: "legacy-key", siteId: "legacy-site" },
        },
      };
      await writeFile(configPath, JSON.stringify(legacyConfig));

      const config = await configManager.load();
      const profile = config.profiles.prod;

      // Should have migrated to new format
      expect(profile.publishableKey).toBe("legacy-key");
      expect(profile.secretKey).toBe("legacy-key");
      expect(profile.siteUuid).toBe("legacy-site");
    });

    it("preserves provided timestamps but fixes invalid or missing ones", async () => {
      const config = {
        version: 1,
        current: "partial",
        profiles: {
          partial: {
            publishableKey: "key",
            secretKey: "secret",
            siteUuid: "site",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          malformed: {
            publishableKey: "key",
            secretKey: "secret",
            siteUuid: "site",
            createdAt: 123,
            updatedAt: 456,
          },
        },
      };
      await writeFile(configPath, JSON.stringify(config));

      const loadedConfig = await configManager.load();

      expect(loadedConfig.profiles.partial.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(loadedConfig.profiles.partial.updatedAt).toBe("2024-01-01T00:00:00.000Z");

      expect(Number.isNaN(Date.parse(loadedConfig.profiles.malformed.createdAt))).toBeFalse();
      expect(loadedConfig.profiles.malformed.createdAt).toBe(loadedConfig.profiles.malformed.updatedAt);
    });
  });

  describe("save()", () => {
    it("sets secure file permissions on Unix", async () => {
      await configManager.load();
      await configManager.save();

      if (process.platform !== "win32") {
        const stats = await stat(configPath);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });

    it("creates parent directory if it does not exist", async () => {
      const nestedPath = join(testDir, "nested", "dir", "config.json");
      const nestedManager = new ConfigManager(nestedPath);

      await nestedManager.load();

      const content = await readFile(nestedPath, "utf-8");
      expect(JSON.parse(content)).toMatchObject(DEFAULT_CONFIG);
    });

    it("throws ConfigError if save called before load", async () => {
      const freshManager = new ConfigManager(configPath);

      await expect(freshManager.save()).rejects.toThrow(ConfigError);
      await expect(freshManager.save()).rejects.toMatchObject({
        code: "NOT_LOADED",
      });
    });
  });

  describe("setProfile()", () => {
    it("adds a new profile", async () => {
      await configManager.setProfile("prod", {
        publishableKey: "test-pub-key",
        secretKey: "test-secret-key",
        siteUuid: "test-site-uuid",
      });

      const profiles = await configManager.listProfiles();
      expect(profiles).toContain("prod");

      const profile = await configManager.getProfile("prod");
      expect(profile?.publishableKey).toBe("test-pub-key");
      expect(profile?.secretKey).toBe("test-secret-key");
      expect(profile?.siteUuid).toBe("test-site-uuid");
    });

    it("sets createdAt and updatedAt timestamps", async () => {
      const before = Date.now() - 1; // Add 1ms buffer for timing variance
      await configManager.setProfile("prod", {
        publishableKey: "test-pub-key",
        secretKey: "test-secret-key",
        siteUuid: "test-site-uuid",
      });
      const after = Date.now() + 1; // Add 1ms buffer for timing variance

      const profile = await configManager.getProfile("prod");
      expect(profile?.createdAt).toBeDefined();
      expect(profile?.updatedAt).toBeDefined();

      const createdTime = new Date(profile!.createdAt).getTime();
      expect(createdTime).toBeGreaterThanOrEqual(before);
      expect(createdTime).toBeLessThanOrEqual(after);
    });

    it("updates existing profile and preserves createdAt", async () => {
      await configManager.setProfile("prod", {
        publishableKey: "old-pub-key",
        secretKey: "old-secret-key",
        siteUuid: "old-site-uuid",
      });

      const originalProfile = await configManager.getProfile("prod");
      const originalCreatedAt = originalProfile?.createdAt;

      // Wait a tiny bit to ensure updatedAt is different
      await new Promise((r) => setTimeout(r, 10));

      await configManager.setProfile("prod", {
        publishableKey: "new-pub-key",
        secretKey: "new-secret-key",
        siteUuid: "new-site-uuid",
      });

      const updatedProfile = await configManager.getProfile("prod");
      expect(updatedProfile?.publishableKey).toBe("new-pub-key");
      expect(updatedProfile?.secretKey).toBe("new-secret-key");
      expect(updatedProfile?.siteUuid).toBe("new-site-uuid");
      expect(updatedProfile?.createdAt).toBe(originalCreatedAt);
      expect(updatedProfile?.updatedAt).not.toBe(originalCreatedAt);
    });

    it("persists profile to disk", async () => {
      await configManager.setProfile("prod", {
        publishableKey: "test-pub-key",
        secretKey: "test-secret-key",
        siteUuid: "test-site-uuid",
      });

      // Read directly from disk
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.profiles.prod.publishableKey).toBe("test-pub-key");
      expect(parsed.profiles.prod.secretKey).toBe("test-secret-key");
      expect(parsed.profiles.prod.siteUuid).toBe("test-site-uuid");
    });

    it("throws ConfigError for empty profile name", async () => {
      await expect(
        configManager.setProfile("", { publishableKey: "key", secretKey: "secret", siteUuid: "site" })
      ).rejects.toThrow(ConfigError);
      await expect(
        configManager.setProfile("", { publishableKey: "key", secretKey: "secret", siteUuid: "site" })
      ).rejects.toMatchObject({ code: "INVALID_NAME" });
    });

    it("throws ConfigError for invalid profile name characters", async () => {
      await expect(
        configManager.setProfile("my profile", { publishableKey: "key", secretKey: "secret", siteUuid: "site" })
      ).rejects.toThrow(ConfigError);
      await expect(
        configManager.setProfile("my/profile", { publishableKey: "key", secretKey: "secret", siteUuid: "site" })
      ).rejects.toThrow(ConfigError);
    });

    it("allows valid profile names", async () => {
      await configManager.setProfile("prod-env", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("staging_env", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("dev123", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });

      const profiles = await configManager.listProfiles();
      expect(profiles).toContain("prod-env");
      expect(profiles).toContain("staging_env");
      expect(profiles).toContain("dev123");
    });
  });

  describe("removeProfile()", () => {
    it("removes an existing profile", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      expect(await configManager.hasProfile("prod")).toBe(true);

      const removed = await configManager.removeProfile("prod");

      expect(removed).toBe(true);
      expect(await configManager.hasProfile("prod")).toBe(false);
    });

    it("returns false for non-existent profile", async () => {
      const removed = await configManager.removeProfile("nonexistent");
      expect(removed).toBe(false);
    });

    it("sets current to null if removed profile was current", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.useProfile("prod");

      expect(await configManager.getCurrentProfileName()).toBe("prod");

      await configManager.removeProfile("prod");

      expect(await configManager.getCurrentProfileName()).toBeNull();
    });

    it("does not affect current if removed profile was not current", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("staging", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.useProfile("staging");

      await configManager.removeProfile("prod");

      expect(await configManager.getCurrentProfileName()).toBe("staging");
    });

    it("persists removal to disk", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.removeProfile("prod");

      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.profiles.prod).toBeUndefined();
    });
  });

  describe("useProfile()", () => {
    it("switches to an existing profile", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("staging", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });

      await configManager.useProfile("staging");

      expect(await configManager.getCurrentProfileName()).toBe("staging");
    });

    it("throws ConfigError for non-existent profile", async () => {
      await expect(configManager.useProfile("nonexistent")).rejects.toThrow(ConfigError);
      await expect(configManager.useProfile("nonexistent")).rejects.toMatchObject({
        code: "PROFILE_NOT_FOUND",
      });
    });

    it("includes available profiles in error message", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("staging", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });

      try {
        await configManager.useProfile("nonexistent");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain("prod");
        expect((error as Error).message).toContain("staging");
      }
    });

    it("persists current profile to disk", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.useProfile("prod");

      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.current).toBe("prod");
    });
  });

  describe("getCurrentProfile()", () => {
    it("returns null when no current profile is set", async () => {
      const profile = await configManager.getCurrentProfile();
      expect(profile).toBeNull();
    });

    it("returns the current profile", async () => {
      await configManager.setProfile("prod", { publishableKey: "prod-pub-key", secretKey: "prod-secret-key", siteUuid: "prod-site-uuid" });
      await configManager.useProfile("prod");

      const profile = await configManager.getCurrentProfile();

      expect(profile?.publishableKey).toBe("prod-pub-key");
      expect(profile?.secretKey).toBe("prod-secret-key");
      expect(profile?.siteUuid).toBe("prod-site-uuid");
    });

    it("returns null if current profile name does not exist in profiles", async () => {
      // Manually create invalid state
      const config = await configManager.load();
      config.current = "deleted";

      const profile = await configManager.getCurrentProfile();
      expect(profile).toBeNull();
    });
  });

  describe("listProfiles()", () => {
    it("returns empty array for fresh config", async () => {
      const profiles = await configManager.listProfiles();
      expect(profiles).toEqual([]);
    });

    it("returns all profile names", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("staging", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      await configManager.setProfile("dev", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });

      const profiles = await configManager.listProfiles();

      expect(profiles).toContain("prod");
      expect(profiles).toContain("staging");
      expect(profiles).toContain("dev");
      expect(profiles.length).toBe(3);
    });
  });

  describe("hasProfile()", () => {
    it("returns false for non-existent profile", async () => {
      expect(await configManager.hasProfile("nonexistent")).toBe(false);
    });

    it("returns true for existing profile", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });
      expect(await configManager.hasProfile("prod")).toBe(true);
    });
  });

  describe("getConfigPath()", () => {
    it("returns the config file path", () => {
      expect(configManager.getConfigPath()).toBe(configPath);
    });
  });

  describe("resetCache()", () => {
    it("forces reload from disk on next load", async () => {
      await configManager.setProfile("prod", { publishableKey: "key", secretKey: "secret", siteUuid: "site" });

      // Modify file directly
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);
      parsed.profiles.prod.publishableKey = "modified-key";
      await writeFile(configPath, JSON.stringify(parsed));

      // Without resetCache, would still see cached value
      const cachedProfile = await configManager.getProfile("prod");
      expect(cachedProfile?.publishableKey).toBe("key");

      // After resetCache, should see new value
      configManager.resetCache();
      const freshProfile = await configManager.getProfile("prod");
      expect(freshProfile?.publishableKey).toBe("modified-key");
    });
  });

  describe("config survives CLI restarts", () => {
    it("persists data across ConfigManager instances", async () => {
      // First instance: create profile
      const manager1 = new ConfigManager(configPath);
      await manager1.setProfile("prod", { publishableKey: "prod-pub-key", secretKey: "prod-secret-key", siteUuid: "prod-site-uuid" });
      await manager1.useProfile("prod");

      // Second instance: should see the data
      const manager2 = new ConfigManager(configPath);
      const profile = await manager2.getCurrentProfile();

      expect(profile?.publishableKey).toBe("prod-pub-key");
      expect(profile?.secretKey).toBe("prod-secret-key");
      expect(profile?.siteUuid).toBe("prod-site-uuid");
      expect(await manager2.getCurrentProfileName()).toBe("prod");
    });
  });
});
