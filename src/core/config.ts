/**
 * Profile and configuration management
 *
 * Handles:
 * - Multiple profile support (prod, staging, etc.)
 * - API key and site ID storage
 * - Profile switching
 * - Secure file permissions (0600 on Unix)
 *
 * Config location (via env-paths):
 * - macOS: ~/Library/Application Support/bento/config.json
 * - Linux: ~/.config/bento/config.json
 * - Windows: %APPDATA%/bento/config.json
 */

import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import envPaths from "env-paths";
import {
  type BentoConfig,
  type BentoProfile,
  type ProfileInput,
  DEFAULT_CONFIG,
} from "../types/config";

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ConfigManager {
  private configPath: string;
  private config: BentoConfig | null = null;

  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    } else if (process.env.BENTO_CONFIG_PATH) {
      // Support config path override via environment variable (for testing)
      this.configPath = process.env.BENTO_CONFIG_PATH;
    } else {
      const paths = envPaths("bento", { suffix: "" });
      // Use data path for Application Support on macOS (per spec)
      // env-paths.config returns ~/Library/Preferences on macOS
      // env-paths.data returns ~/Library/Application Support on macOS
      this.configPath = join(paths.data, "config.json");
    }
  }

  /**
   * Load config from disk, creating default if not exists
   */
  async load(): Promise<BentoConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(content);
      this.config = this.validate(parsed);
      return this.config;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // Config file doesn't exist, create default
        // Deep copy to avoid sharing the profiles object between instances
        this.config = {
          ...DEFAULT_CONFIG,
          profiles: { ...DEFAULT_CONFIG.profiles },
        };
        await this.save();
        return this.config;
      }

      if (error instanceof SyntaxError) {
        throw new ConfigError(
          `Invalid config file at ${this.configPath}. File contains invalid JSON. ` +
            "Delete the file or fix the JSON syntax to continue.",
          "INVALID_JSON"
        );
      }

      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "EACCES" || error.code === "EPERM")
      ) {
        throw new ConfigError(
          `Permission denied reading config at ${this.configPath}. ` +
            "Check file permissions or run with appropriate privileges.",
          "PERMISSION_DENIED"
        );
      }

      throw error;
    }
  }

  /**
   * Validate config schema and return typed config
   */
  private validate(data: unknown): BentoConfig {
    if (typeof data !== "object" || data === null) {
      throw new ConfigError(
        "Config file must contain a JSON object",
        "INVALID_SCHEMA"
      );
    }

    const obj = data as Record<string, unknown>;

    // Check version — default to 1 if missing, only reject future versions
    if (obj.version === undefined || obj.version === null) {
      obj.version = 1;
    }

    if (obj.version !== 1) {
      throw new ConfigError(
        `Unsupported config version: ${obj.version}. Expected version 1.`,
        "UNSUPPORTED_VERSION"
      );
    }

    // Default current to null if missing or invalid
    if (obj.current === undefined || (obj.current !== null && typeof obj.current !== "string")) {
      obj.current = null;
    }

    // Default profiles to empty object if missing or invalid
    if (typeof obj.profiles !== "object" || obj.profiles === null) {
      obj.profiles = {};
    }

    // Validate each profile
    const profiles = obj.profiles as Record<string, unknown>;
    for (const [name, profile] of Object.entries(profiles)) {
      if (typeof profile !== "object" || profile === null) {
        throw new ConfigError(
          `Profile '${name}' must be an object`,
          "INVALID_SCHEMA"
        );
      }

      const p = profile as Record<string, unknown>;

      // Check for new format (publishableKey, secretKey, siteUuid)
      const hasNewFormat =
        typeof p.publishableKey === "string" &&
        typeof p.secretKey === "string" &&
        typeof p.siteUuid === "string";

      // Check for legacy format (apiKey, siteId) and migrate
      const hasLegacyFormat =
        typeof p.apiKey === "string" && typeof p.siteId === "string";

      if (!hasNewFormat && !hasLegacyFormat) {
        throw new ConfigError(
          `Profile '${name}' must have valid credentials (publishableKey, secretKey, siteUuid)`,
          "INVALID_SCHEMA"
        );
      }

      // Migrate legacy format to new format
      if (hasLegacyFormat && !hasNewFormat) {
        p.publishableKey = p.apiKey;
        p.secretKey = p.apiKey;
        p.siteUuid = p.siteId;
        delete p.apiKey;
        delete p.siteId;
      }

      if (typeof p.createdAt !== "string" || !p.createdAt) {
        p.createdAt = new Date().toISOString();
      }

      if (typeof p.updatedAt !== "string" || !p.updatedAt) {
        p.updatedAt = p.createdAt;
      }
    }

    return data as BentoConfig;
  }

  /**
   * Save config to disk with secure permissions
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new ConfigError(
        "No config loaded. Call load() first.",
        "NOT_LOADED"
      );
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.configPath);
      await mkdir(dir, { recursive: true });

      // Write config file
      const content = JSON.stringify(this.config, null, 2);
      await writeFile(this.configPath, content, "utf-8");

      // Set secure file permissions (owner read/write only) on Unix
      if (process.platform !== "win32") {
        await chmod(this.configPath, 0o600);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "EACCES" || error.code === "EPERM")
      ) {
        throw new ConfigError(
          `Permission denied writing config to ${this.configPath}. ` +
            "Check file/directory permissions or run with appropriate privileges.",
          "PERMISSION_DENIED"
        );
      }
      throw error;
    }
  }

  /**
   * Get the currently active profile
   */
  async getCurrentProfile(): Promise<BentoProfile | null> {
    const config = await this.load();

    if (!config.current) {
      return null;
    }

    const profile = config.profiles[config.current];
    return profile || null;
  }

  /**
   * Get the name of the currently active profile
   */
  async getCurrentProfileName(): Promise<string | null> {
    const config = await this.load();
    return config.current;
  }

  /**
   * Get a specific profile by name
   */
  async getProfile(name: string): Promise<BentoProfile | null> {
    const config = await this.load();
    return config.profiles[name] || null;
  }

  /**
   * Add or update a profile
   */
  async setProfile(name: string, profile: ProfileInput): Promise<void> {
    if (!name || typeof name !== "string") {
      throw new ConfigError("Profile name must be a non-empty string", "INVALID_NAME");
    }

    // Validate name format (alphanumeric, hyphen, underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new ConfigError(
        "Profile name can only contain letters, numbers, hyphens, and underscores",
        "INVALID_NAME"
      );
    }

    const config = await this.load();
    const now = new Date().toISOString();

    const existingProfile = config.profiles[name];
    config.profiles[name] = {
      publishableKey: profile.publishableKey,
      secretKey: profile.secretKey,
      siteUuid: profile.siteUuid,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now,
    };

    await this.save();
  }

  /**
   * Remove a profile
   * Returns true if profile existed and was removed
   */
  async removeProfile(name: string): Promise<boolean> {
    const config = await this.load();

    if (!config.profiles[name]) {
      return false;
    }

    delete config.profiles[name];

    // If removed profile was current, set current to null
    if (config.current === name) {
      config.current = null;
    }

    await this.save();
    return true;
  }

  /**
   * Switch active profile
   */
  async useProfile(name: string): Promise<void> {
    const config = await this.load();

    if (!config.profiles[name]) {
      const available = Object.keys(config.profiles);
      const suggestion =
        available.length > 0
          ? ` Available profiles: ${available.join(", ")}`
          : " No profiles configured. Run 'bento auth login' to create one.";

      throw new ConfigError(
        `Profile '${name}' not found.${suggestion}`,
        "PROFILE_NOT_FOUND"
      );
    }

    config.current = name;
    await this.save();
  }

  /**
   * List all profile names
   */
  async listProfiles(): Promise<string[]> {
    const config = await this.load();
    return Object.keys(config.profiles);
  }

  /**
   * Check if a profile exists
   */
  async hasProfile(name: string): Promise<boolean> {
    const config = await this.load();
    return name in config.profiles;
  }

  /**
   * Get config file path (for display purposes)
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Reset the cached config (useful for testing)
   */
  resetCache(): void {
    this.config = null;
  }
}

// Singleton instance for normal usage
export const config = new ConfigManager();

// Re-export types for convenience
export type { BentoConfig, BentoProfile, ProfileInput };

// Convenience functions using the singleton
export function getConfigPath(): string {
  return config.getConfigPath();
}

export async function getConfig(): Promise<BentoConfig> {
  return config.load();
}

export async function saveConfig(newConfig: BentoConfig): Promise<void> {
  const cfg = await config.load();
  Object.assign(cfg, newConfig);
  await config.save();
}

export async function getCurrentProfile(): Promise<BentoProfile | null> {
  return config.getCurrentProfile();
}
