/**
 * Events commands
 *
 * Commands:
 * - bento events track --email <email> --event <name> [--details <json>] - Track a custom event
 * - bento events import <file> - Import events from a JSON file
 * - bento events purchase --email <e> --amount <n> --currency <c> --key <k> [--cart <json>]
 */

import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";

interface TrackOptions {
  email: string;
  event: string;
  details?: string;
}

interface PurchaseOptions {
  email: string;
  amount: string;
  currency: string;
  key: string;
  cart?: string;
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
        output.failSpinner();
        handleError(error);
      }
    });

  events
    .command("import")
    .description("Import events from a JSON file (up to 1000)")
    .argument("<file>", "JSON file with array of event objects ({email, type, details?, date?})")
    .action(async (file: string) => {
      try {
        let eventData: Array<{
          email: string;
          type: string;
          details?: Record<string, unknown>;
          date?: string;
        }>;

        try {
          const raw = await readFile(file, "utf-8");
          eventData = JSON.parse(raw);
        } catch {
          output.error(`Failed to read or parse ${file}. Ensure it is valid JSON.`);
          process.exit(1);
        }

        if (!Array.isArray(eventData) || eventData.length === 0) {
          output.error("File must contain a non-empty array of event objects.");
          process.exit(1);
        }

        output.startSpinner(`Importing ${eventData.length} event(s)...`);

        const events = eventData.map((e) => ({
          email: e.email,
          type: e.type,
          details: e.details,
          date: e.date ? new Date(e.date) : undefined,
        }));

        const count = await bento.importEvents(events);

        output.stopSpinner("Events imported");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { imported: count },
            meta: { count },
          });
        } else if (!output.isQuiet()) {
          output.success(`Imported ${count} event(s).`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  events
    .command("purchase")
    .description("Track a purchase event for a subscriber (TRIGGERS automations)")
    .requiredOption("-e, --email <email>", "Subscriber email address")
    .requiredOption("--amount <amount>", "Purchase amount (in cents)")
    .requiredOption("--currency <currency>", "Currency code (e.g., USD)")
    .requiredOption("--key <key>", "Unique purchase key/ID")
    .option("--cart <json>", "Cart details as JSON")
    .action(async (opts: PurchaseOptions) => {
      try {
        const amount = Number(opts.amount);
        if (Number.isNaN(amount)) {
          output.error("--amount must be a number.");
          process.exit(1);
        }

        let cart: { abandoned_checkout_url?: string; items?: unknown[] } | undefined;
        if (opts.cart) {
          try {
            cart = JSON.parse(opts.cart);
          } catch {
            output.error("Invalid JSON in --cart. Ensure valid JSON format.");
            process.exit(1);
          }
        }

        output.startSpinner("Tracking purchase...");

        const success = await bento.trackPurchase(opts.email, {
          unique: { key: opts.key },
          value: { currency: opts.currency, amount },
          cart,
        });

        if (!success) {
          output.failSpinner("Failed to track purchase");
          process.exit(1);
        }

        output.stopSpinner("Purchase tracked");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: {
              email: opts.email,
              amount,
              currency: opts.currency,
              key: opts.key,
            },
            meta: { count: 1 },
          });
        } else if (!output.isQuiet()) {
          output.success(
            `Tracked purchase of ${amount} ${opts.currency} for ${opts.email}`
          );
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });
}

function handleError(error: unknown): void {
  if (error instanceof CLIError || error instanceof Error) {
    output.error(error.message);
  } else {
    output.error("An unexpected error occurred.");
  }
  process.exit(1);
}
