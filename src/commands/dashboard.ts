import { Command } from "commander";

import { config } from "../core/config";
import { output } from "../core/output";
import { openInBrowser, BrowserOpenError } from "../utils/browser";

const DASHBOARD_BASE_URL = process.env.BENTO_DASHBOARD_URL ?? "https://app.bentonow.com/";

interface DashboardCommandOptions {
  profile?: string;
}

interface ProfileContext {
  name: string;
  siteUuid: string;
}

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Open the Bento dashboard in your browser")
    .option("-p, --profile <name>", "Open the dashboard for a specific profile")
    .action(async (options: DashboardCommandOptions) => {
      try {
        const profileContext = await resolveProfile(options.profile);
        const url = buildDashboardUrl(profileContext?.siteUuid);

        await openInBrowser(url);

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              url,
              profile: profileContext?.name ?? null,
              siteUuid: profileContext?.siteUuid ?? null,
            },
            meta: { count: 1 },
          });
          return;
        }

        if (output.isQuiet()) {
          return;
        }

        if (profileContext) {
          output.success(`Opening Bento dashboard for "${profileContext.name}" in your browser...`);
        } else {
          output.success("Opening the Bento dashboard login page in your browser...");
          output.info("No active profile is selected. Run 'bento auth login' to connect a site.");
        }
      } catch (error) {
        handleDashboardError(error);
      }
    });
}

async function resolveProfile(profileName?: string): Promise<ProfileContext | null> {
  if (profileName) {
    const profile = await config.getProfile(profileName);
    if (!profile) {
      throw new Error(
        `Profile "${profileName}" not found. Use 'bento profile list' to view configured profiles.`
      );
    }
    return {
      name: profileName,
      siteUuid: profile.siteUuid,
    };
  }

  const profile = await config.getCurrentProfile();
  if (!profile) {
    return null;
  }

  const currentName = (await config.getCurrentProfileName()) ?? "default";
  return {
    name: currentName,
    siteUuid: profile.siteUuid,
  };
}

function buildDashboardUrl(siteUuid?: string): string {
  const url = new URL(DASHBOARD_BASE_URL);
  if (siteUuid) {
    url.searchParams.set("site_uuid", siteUuid);
  }
  return url.toString();
}

function handleDashboardError(error: unknown): never {
  const message = formatErrorMessage(error);

  if (output.isJson()) {
    output.jsonError(message, { code: 1 });
  } else {
    output.error(message);
  }

  process.exit(1);
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof BrowserOpenError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to open the Bento dashboard.";
}
