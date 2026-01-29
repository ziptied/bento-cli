/**
 * Authentication commands
 *
 * Commands:
 * - bento auth login [--profile <name>] - Authenticate with Bento API
 * - bento auth logout - Clear current authentication
 * - bento auth status - Show current authentication status
 */

import { Command } from "commander";
import { password, input } from "@inquirer/prompts";
import { config, ConfigError, type BentoProfile } from "../core/config";
import { validateCredentials, bento } from "../core/sdk";
import { output } from "../core/output";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authentication management");

  auth
    .command("login")
    .description("Authenticate with Bento API")
    .option("-p, --profile <name>", "Profile to store credentials in", "default")
    .option("--api-key <key>", "API key (for non-interactive use)")
    .option("--site-id <id>", "Site ID (for non-interactive use)")
    .action(async (options: { profile: string; apiKey?: string; siteId?: string }) => {
      try {
        let apiKey = options.apiKey;
        let siteId = options.siteId;

        // Check for explicitly empty values first (before interactive check)
        if (apiKey !== undefined && !apiKey.trim()) {
          output.error("API key cannot be empty.");
          process.exit(1);
        }

        if (siteId !== undefined && !siteId.trim()) {
          output.error("Site ID cannot be empty.");
          process.exit(1);
        }

        // Interactive mode if credentials not provided via flags
        if (!apiKey || !siteId) {
          if (!process.stdin.isTTY) {
            output.error(
              "Non-interactive mode requires --api-key and --site-id flags."
            );
            process.exit(1);
          }

          output.info("Authenticate with your Bento API credentials.");
          output.log("Find your credentials at: https://app.bentonow.com/settings/api");
          output.newline();

          if (!apiKey) {
            apiKey = await password({
              message: "Enter your Bento API key:",
              mask: "*",
            });
          }

          if (!siteId) {
            siteId = await input({
              message: "Enter your Bento Site ID:",
            });
          }
        }

        apiKey = apiKey!.trim();
        siteId = siteId!.trim();

        // Validate credentials against API
        output.startSpinner("Validating credentials...");
        const isValid = await validateCredentials(apiKey, siteId);

        if (!isValid) {
          output.failSpinner("Invalid credentials");
          output.error(
            "Invalid credentials. Please check your API key and Site ID."
          );
          process.exit(1);
        }

        output.stopSpinner("Credentials validated");

        // Save to config
        await config.setProfile(options.profile, { apiKey, siteId });
        await config.useProfile(options.profile);

        // Reset the SDK client so it picks up the new credentials
        bento.reset();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              profile: options.profile,
              siteId,
            },
            meta: { count: 1 },
          });
        } else {
          output.success(`Authenticated and saved to profile "${options.profile}"`);
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          output.error(`${error.message}`);
          process.exit(1);
        }
        throw error;
      }
    });

  auth
    .command("logout")
    .description("Clear current authentication")
    .action(async () => {
      try {
        const currentProfileName = await config.getCurrentProfileName();

        if (!currentProfileName) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: { loggedOut: false, reason: "not_authenticated" },
              meta: { count: 0 },
            });
          } else {
            output.warn("No active profile to log out from.");
          }
          return;
        }

        // Remove the current profile
        await config.removeProfile(currentProfileName);

        // Reset the SDK client
        bento.reset();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { loggedOut: true, profile: currentProfileName },
            meta: { count: 1 },
          });
        } else {
          output.success(`Logged out from profile "${currentProfileName}"`);
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          output.error(`${error.message}`);
          process.exit(1);
        }
        throw error;
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
      try {
        const currentProfileName = await config.getCurrentProfileName();
        const currentProfile = await config.getCurrentProfile();

        if (!currentProfileName || !currentProfile) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: { authenticated: false },
              meta: { count: 0 },
            });
          } else {
            output.info(
              "Not authenticated. Run 'bento auth login' to authenticate."
            );
          }
          return;
        }

        const maskedApiKey = maskApiKey(currentProfile.apiKey);

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              authenticated: true,
              profile: currentProfileName,
              siteId: currentProfile.siteId,
              apiKey: maskedApiKey,
              createdAt: currentProfile.createdAt,
              updatedAt: currentProfile.updatedAt,
            },
            meta: { count: 1 },
          });
        } else {
          output.object({
            Profile: currentProfileName,
            "Site ID": currentProfile.siteId,
            "API Key": maskedApiKey,
            "Created": formatDate(currentProfile.createdAt),
            "Updated": formatDate(currentProfile.updatedAt),
          });
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          output.error(`${error.message}`);
          process.exit(1);
        }
        throw error;
      }
    });
}

/**
 * Mask an API key for display, showing only first and last few characters
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) {
    return "*".repeat(apiKey.length);
  }
  if (apiKey.length <= 12) {
    return `${apiKey.slice(0, 4)}${"*".repeat(apiKey.length - 4)}`;
  }
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

/**
 * Format ISO date string for display
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}
