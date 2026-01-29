/**
 * Events commands
 *
 * Commands:
 * - bento events track --email <email> --event <name> [--details <json>] - Track a custom event
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

interface TrackOptions {
  email: string;
  event: string;
  details?: string;
}

export function registerEventsCommands(program: Command): void {
  const events = program
    .command("events")
    .description("Track events for subscribers");

  events
    .command("track")
    .description("Track a custom event for a subscriber")
    .requiredOption("-e, --email <email>", "Subscriber email address")
    .requiredOption("--event <name>", "Event name (e.g., 'button_clicked', 'purchase')")
    .option("-d, --details <json>", "Event details as JSON (e.g., '{\"product\": \"widget\"}')")
    .action(async (options: TrackOptions) => {
      try {
        let details: Record<string, unknown> | undefined;

        if (options.details) {
          try {
            details = JSON.parse(options.details);
          } catch {
            output.error("Invalid JSON in --details. Ensure valid JSON format.");
            process.exit(1);
          }
        }

        output.startSpinner("Tracking event...");

        const success = await bento.track({
          email: options.email,
          type: options.event,
          details,
        });

        if (!success) {
          output.failSpinner("Failed to track event");
          output.error("Event tracking failed. Please verify the email address is valid.");
          process.exit(1);
        }

        output.stopSpinner("Event tracked");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              email: options.email,
              event: options.event,
              details: details ?? null,
            },
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(`Tracked event "${options.event}" for ${options.email}`);
          if (details) {
            output.info(`Details: ${JSON.stringify(details)}`);
          }
        }
      } catch (error) {
        if (error instanceof CLIError) {
          output.failSpinner();
          output.error(error.message);
          process.exit(1);
        }
        throw error;
      }
    });
}
