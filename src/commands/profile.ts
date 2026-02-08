/**
 * Profile management commands
 *
 * Commands:
 * - bento profile add <name> - Add a new profile
 * - bento profile list - List all profiles
 * - bento profile use <name> - Switch to a profile
 * - bento profile remove <name> - Remove a profile
 */

import { Command } from "commander";
import { password, input, confirm } from "@inquirer/prompts";
import { config, ConfigError } from "../core/config";
import { validateCredentials, bento } from "../core/sdk";
import { output } from "../core/output";

interface AddOptions {
  publishableKey?: string;
  secretKey?: string;
  siteUuid?: string;
}

export function registerProfileCommands(program: Command): void {
  const profile = program
    .command("profile")
    .description("Manage credential profiles");

  profile
    .command("add")
    .argument("<name>", "Name for the new profile")
    .description("Add a new profile")
    .option("--publishable-key <key>", "Publishable key (for non-interactive use)")
    .option("--secret-key <key>", "Secret key (for non-interactive use)")
    .option("--site-uuid <uuid>", "Site UUID (for non-interactive use)")
    .action(async (name: string, options: AddOptions) => {
      try {
        // Check if profile already exists
        const exists = await config.hasProfile(name);
        if (exists) {
          output.error(
            `Profile "${name}" already exists. Use 'bento auth login --profile ${name}' to update it.`
          );
          process.exit(1);
        }

        let publishableKey = options.publishableKey;
        let secretKey = options.secretKey;
        let siteUuid = options.siteUuid;

        // Interactive mode if credentials not provided via flags
        const needsInteractive = !publishableKey || !secretKey || !siteUuid;
        if (needsInteractive) {
          if (!process.stdin.isTTY) {
            output.error(
              "Non-interactive mode requires --publishable-key, --secret-key, and --site-uuid flags."
            );
            process.exit(1);
          }

          output.info(`Creating profile "${name}"`);
          output.log("Find your credentials at: https://app.bentonow.com/account/teams");
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

        // Validate inputs
        if (!publishableKey?.trim()) {
          output.error("Publishable key cannot be empty.");
          process.exit(1);
        }

        if (!secretKey?.trim()) {
          output.error("Secret key cannot be empty.");
          process.exit(1);
        }

        if (!siteUuid?.trim()) {
          output.error("Site UUID cannot be empty.");
          process.exit(1);
        }

        publishableKey = publishableKey.trim();
        secretKey = secretKey.trim();
        siteUuid = siteUuid.trim();

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
        await config.setProfile(name, { publishableKey, secretKey, siteUuid });

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { profile: name, siteUuid },
            meta: { count: 1 },
          });
        } else {
          output.success(`Profile "${name}" created`);
          output.info(`Switch to it with: bento profile use ${name}`);
        }
      } catch (error) {
        output.failSpinner();
        if (error instanceof ConfigError) {
          output.error(error.message);
        } else if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });

  profile
    .command("list")
    .description("List all profiles")
    .action(async () => {
      try {
        const cfg = await config.load();
        const profileNames = Object.keys(cfg.profiles);

        if (profileNames.length === 0) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: [],
              meta: { count: 0 },
            });
          } else {
            output.info(
              "No profiles configured. Run 'bento auth login' to create one."
            );
          }
          return;
        }

        const profileData = profileNames.map((name) => {
          const p = cfg.profiles[name];
          return {
            name,
            current: name === cfg.current ? "✓" : "",
            siteUuid: p.siteUuid,
            created: formatDateShort(p.createdAt),
          };
        });

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: profileData.map((p) => ({
              ...p,
              current: p.current === "✓",
            })),
            meta: { count: profileData.length },
          });
        } else {
          output.table(profileData, {
            columns: [
              { key: "current", header: "" },
              { key: "name", header: "NAME" },
              { key: "siteUuid", header: "SITE UUID" },
              { key: "created", header: "CREATED" },
            ],
          });
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          output.error(error.message);
        } else if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });

  profile
    .command("use")
    .argument("<name>", "Name of the profile to switch to")
    .description("Switch to a profile")
    .action(async (name: string) => {
      try {
        await config.useProfile(name);

        // Reset the SDK client so it picks up the new credentials
        bento.reset();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { profile: name },
            meta: { count: 1 },
          });
        } else {
          output.success(`Switched to profile "${name}"`);
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          output.error(error.message);
        } else if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });

  profile
    .command("remove")
    .argument("<name>", "Name of the profile to remove")
    .description("Remove a profile")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (name: string, options: { yes?: boolean }) => {
      try {
        // Check if profile exists
        const exists = await config.hasProfile(name);
        if (!exists) {
          output.error(`Profile "${name}" not found.`);
          process.exit(1);
        }

        // Confirm deletion unless --yes flag is passed
        if (!options.yes) {
          if (!process.stdin.isTTY) {
            output.error(
              "Non-interactive mode requires --yes flag to confirm deletion."
            );
            process.exit(1);
          }

          const confirmed = await confirm({
            message: `Are you sure you want to remove profile "${name}"?`,
            default: false,
          });

          if (!confirmed) {
            output.info("Aborted.");
            return;
          }
        }

        const currentProfileName = await config.getCurrentProfileName();
        const wasCurrentProfile = currentProfileName === name;

        await config.removeProfile(name);

        // Reset the SDK client if we removed the current profile
        if (wasCurrentProfile) {
          bento.reset();
        }

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { profile: name, wasCurrentProfile },
            meta: { count: 1 },
          });
        } else {
          output.success(`Profile "${name}" removed`);
          if (wasCurrentProfile) {
            output.info(
              "This was the active profile. Run 'bento auth login' or 'bento profile use <name>' to authenticate."
            );
          }
        }
      } catch (error) {
        if (error instanceof ConfigError) {
          output.error(error.message);
        } else if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("An unexpected error occurred.");
        }
        process.exit(1);
      }
    });
}

/**
 * Format ISO date string for table display (short format)
 */
function formatDateShort(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
