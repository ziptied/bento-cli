/**
 * Stats commands
 *
 * Commands:
 * - bento stats site - Show site-wide statistics
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

export function registerStatsCommands(program: Command): void {
  const stats = program
    .command("stats")
    .description("View site statistics");

  stats
    .command("site")
    .description("Show site-wide statistics")
    .action(async () => {
      try {
        output.startSpinner("Fetching site stats...");

        const siteStats = await bento.getSiteStats();
        output.stopSpinner();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: siteStats,
            meta: { count: 1 },
          });
          return;
        }

        if (output.isQuiet()) {
          return;
        }

        output.divider();
        output.log("Site Statistics");
        output.divider();
        output.newline();

        // Subscriber metrics
        output.object({
          "Total Subscribers": formatNumber(siteStats.total_subscribers),
          "Active Subscribers": formatNumber(siteStats.active_subscribers),
          "Unsubscribed": formatNumber(siteStats.unsubscribed_count),
        });

        output.newline();

        // Broadcast metrics
        output.object({
          "Total Broadcasts": formatNumber(siteStats.broadcast_count),
          "Avg. Open Rate": formatPercent(siteStats.average_open_rate),
          "Avg. Click Rate": formatPercent(siteStats.average_click_rate),
        });

        output.divider();
      } catch (error) {
        output.failSpinner();
        if (error instanceof CLIError) {
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
 * Format a number for display with thousand separators
 */
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "N/A";
  }
  return value.toLocaleString();
}

/**
 * Format a decimal rate as a percentage
 */
function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "N/A";
  }
  // If value is already a percentage (> 1), just format it
  // If it's a decimal (0-1), multiply by 100
  const percent = value > 1 ? value : value * 100;
  return `${percent.toFixed(1)}%`;
}
