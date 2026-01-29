/**
 * Profile and configuration management
 *
 * Handles:
 * - Multiple profile support (prod, staging, etc.)
 * - API key and site ID storage
 * - Profile switching
 *
 * Config location (via env-paths):
 * - macOS: ~/Library/Application Support/bento/config.json
 * - Linux: ~/.config/bento/config.json
 */

import envPaths from "env-paths";

const paths = envPaths("bento");

export interface Profile {
  apiKey: string;
  siteId: string;
}

export interface Config {
  current: string;
  profiles: Record<string, Profile>;
}

export function getConfigPath(): string {
  return `${paths.config}/config.json`;
}

export async function getConfig(): Promise<Config | null> {
  // TODO: Implement config loading
  return null;
}

export async function saveConfig(_config: Config): Promise<void> {
  // TODO: Implement config saving
}

export async function getCurrentProfile(): Promise<Profile | null> {
  // TODO: Implement current profile retrieval
  return null;
}
