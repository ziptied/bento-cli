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
import { config, ConfigError } from "../core/config";
import { validateCredentials, bento } from "../core/sdk";
import { output } from "../core/output";

interface LoginOptions {
  profile: string;
  publishableKey?: string;
  secretKey?: string;
  siteUuid?: string;
}

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authentication management");

  auth
    .command("login")
    .description("Authenticate with Bento API")
    .option("-p, --profile <name>", "Profile to store credentials in", "default")
    .option("--publishable-key <key>", "Publishable key (for non-interactive use)")
    .option("--secret-key <key>", "Secret key (for non-interactive use)")
    .option("--site-uuid <uuid>", "Site UUID (for non-interactive use)")
    .action(async (options: LoginOptions) => {
      try {
        let publishableKey = options.publishableKey;
        let secretKey = options.secretKey;
        let siteUuid = options.siteUuid;

        // Check for explicitly empty values first (before interactive check)
        if (publishableKey !== undefined && !publishableKey.trim()) {
          output.error("Publishable key cannot be empty.");
          process.exit(1);
        }

        if (secretKey !== undefined && !secretKey.trim()) {
          output.error("Secret key cannot be empty.");
          process.exit(1);
        }

        if (siteUuid !== undefined && !siteUuid.trim()) {
          output.error("Site UUID cannot be empty.");
          process.exit(1);
        }

        // Interactive mode if credentials not provided via flags
        const needsInteractive = !publishableKey || !secretKey || !siteUuid;
        if (needsInteractive) {
          if (!process.stdin.isTTY) {
            output.error(
              "Non-interactive mode requires --publishable-key, --secret-key, and --site-uuid flags."
            );
            process.exit(1);
          }

          output.info("Authenticate with your Bento API credentials.");
          output.log("Find your credentials at: https://app.bentonow.com/settings/api");
          output.newline();

          if (!publishableKey) {
            publishableKey = await password({
              message: "Enter your Publishable Key:",
              mask: "*",
            });
          }

          if (!secretKey) {
            secretKey = await password({
              message: "Enter your Secret Key:",
              mask: "*",
            });
          }

          if (!siteUuid) {
            siteUuid = await input({
              message: "Enter your Site UUID:",
            });
          }
        }

        publishableKey = publishableKey!.trim();
        secretKey = secretKey!.trim();
        siteUuid = siteUuid!.trim();

        // Validate credentials against API
        output.startSpinner("Validating credentials...");
        const isValid = await validateCredentials(publishableKey, secretKey, siteUuid);

        if (!isValid) {
          output.failSpinner("Invalid credentials");
          output.error(
            "Invalid credentials. Please check your Publishable Key, Secret Key, and Site UUID."
          );
          process.exit(1);
        }

        output.stopSpinner("Credentials validated");

        // Save to config
        await config.setProfile(options.profile, { publishableKey, secretKey, siteUuid });
        await config.useProfile(options.profile);

        // Reset the SDK client so it picks up the new credentials
        bento.reset();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              profile: options.profile,
              siteUuid,
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

        const maskedPublishableKey = maskApiKey(currentProfile.publishableKey);
        const maskedSecretKey = maskApiKey(currentProfile.secretKey);

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              authenticated: true,
              profile: currentProfileName,
              siteUuid: currentProfile.siteUuid,
              publishableKey: maskedPublishableKey,
              secretKey: maskedSecretKey,
              createdAt: currentProfile.createdAt,
              updatedAt: currentProfile.updatedAt,
            },
            meta: { count: 1 },
          });
        } else {
          output.object({
            Profile: currentProfileName,
            "Site UUID": currentProfile.siteUuid,
            "Publishable Key": maskedPublishableKey,
            "Secret Key": maskedSecretKey,
            Created: formatDate(currentProfile.createdAt),
            Updated: formatDate(currentProfile.updatedAt),
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
export function maskApiKey(apiKey: string): string {
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
