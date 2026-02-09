/**
 * Stats commands
 *
 * Commands:
 * - bento stats site - Show site-wide statistics
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";
import type { SiteStats } from "../types/sdk";

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

        const stats = siteStats as ExtendedSiteStats;
        const totalSubscribers = pickMetric(stats, ["total_subscribers", "user_count", "subscriber_count"]);
        const activeSubscribers = pickMetric(stats, ["active_subscribers", "subscriber_count", "user_count"]);
        const unsubscribed = pickMetric(stats, ["unsubscribed_count", "unsubscriber_count"]);
        const totalBroadcasts = pickMetric(stats, ["broadcast_count", "total_broadcasts", "broadcasts_count"]);
        const averageOpenRate = pickMetric(stats, ["average_open_rate", "open_rate"]);
        const averageClickRate = pickMetric(stats, ["average_click_rate", "click_rate"]);

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
          "Total Subscribers": formatNumber(totalSubscribers),
          "Active Subscribers": formatNumber(activeSubscribers),
          "Unsubscribed": formatNumber(unsubscribed),
        });

        output.newline();

        // Broadcast metrics
        output.object({
          "Total Broadcasts": formatNumber(totalBroadcasts),
          "Avg. Open Rate": formatPercent(averageOpenRate),
          "Avg. Click Rate": formatPercent(averageClickRate),
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

type LegacySiteStats = {
  user_count?: number;
  subscriber_count?: number;
  unsubscriber_count?: number;
  total_broadcasts?: number;
  broadcasts_count?: number;
  open_rate?: number;
  click_rate?: number;
};

type ExtendedSiteStats = Partial<SiteStats> & LegacySiteStats;
type MetricKey = keyof ExtendedSiteStats;

function pickMetric(stats: ExtendedSiteStats, keys: MetricKey[]): number | undefined {
  for (const key of keys) {
    const value = stats[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}
