import type { Command } from "commander";

import { output } from "../../core/output";
import { bento } from "../../core/sdk";
import type {
  FieldFilter,
  Subscriber,
} from "../../types/sdk";
import { handleSubscriberError, lookupTagNames, requireAtLeastOneFilter } from "./helpers";

interface SearchCommandOptions {
  email?: string;
  tag?: string;
  field?: string[];
  uuid?: string;
}

interface SubscriberRow {
  email: string;
  uuid: string;
  name: string;
  status: string;
  tags: string[];
  tagSummary: string;
  fields: Record<string, unknown>;
  fieldsSummary: string;
}

export function registerSearchCommand(subscribers: Command): void {
  subscribers
    .command("search")
    .description("Look up a subscriber by email or UUID, optionally filtering by tag or field")
    .option("-e, --email <email>", "Look up subscriber by email")
    .option("-t, --tag <tag>", "Filter: only show if subscriber has this tag")
    .option(
      "-f, --field <key=value>",
      "Filter: only show if subscriber field matches (repeatable)",
      collectFieldOptions,
      []
    )
    .option("--uuid <uuid>", "Look up subscriber by UUID")
    .action(async (options: SearchCommandOptions) => {
      const fieldFilters = parseFieldFilters(options.field ?? []);
      const email = options.email?.trim() || undefined;
      const uuid = options.uuid?.trim() || undefined;
      const tag = options.tag?.trim() || undefined;

      requireAtLeastOneFilter(
        Boolean(email || uuid),
        "Provide --email or --uuid to look up a subscriber."
      );

      output.startSpinner("Looking up subscriber...");

      try {
        const result = await bento.searchSubscribers({ email, uuid });
        const subscriber = result.subscriber;

        if (!subscriber) {
          output.stopSpinner();
          renderEmpty();
          return;
        }

        // Client-side tag filtering
        if (tag) {
          const tagIds = new Set(subscriber.attributes.cached_tag_ids ?? []);
          const tagLookup = await lookupTagNames(tagIds);
          const tagNames = [...tagLookup.values()].map((n) => n.toLowerCase());
          if (!tagNames.includes(tag.toLowerCase())) {
            output.stopSpinner();
            renderEmpty(`No subscribers found matching tag "${tag}".`);
            return;
          }
        }

        // Client-side field filtering
        if (fieldFilters.length > 0) {
          const fields = subscriber.attributes.fields ?? {};
          const allMatch = fieldFilters.every((filter) => {
            const actual = fields[filter.key];
            return actual !== undefined && String(actual) === filter.value;
          });
          if (!allMatch) {
            output.stopSpinner();
            renderEmpty("No subscribers found matching field filters.");
            return;
          }
        }

        output.stopSpinner();
        await renderResults([subscriber]);
      } catch (error) {
        output.failSpinner();
        handleSubscriberError(error);
      }
    });
}

function collectFieldOptions(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseFieldFilters(values: string[]): FieldFilter[] {
  return values.map((entry) => {
    const [rawKey, ...rest] = entry.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();

    if (!key || !value) {
      output.error(`Invalid field filter '${entry}'. Use --field key=value.`);
      process.exit(2);
    }

    return { key, value };
  });
}

function renderEmpty(message = "No subscribers found."): void {
  if (output.isJson()) {
    output.json({
      success: true,
      error: null,
      data: [],
      meta: { count: 0 },
    });
    return;
  }

  output.table([], {
    columns: [
      { key: "email", header: "EMAIL", width: 25 },
      { key: "name", header: "NAME", width: 15 },
      { key: "status", header: "STATUS", width: 12 },
      { key: "tags", header: "TAGS", width: 30 },
      { key: "fields", header: "FIELDS", width: 25 },
    ],
    emptyMessage: message,
  });
}

async function renderResults(
  subscribers: Subscriber<Record<string, unknown>>[]
): Promise<void> {
  const tagIds = new Set<string>();
  for (const subscriber of subscribers) {
    const ids = subscriber.attributes.cached_tag_ids ?? [];
    for (const id of ids) {
      if (id) {
        tagIds.add(id);
      }
    }
  }

  const tagLookup = await lookupTagNames(tagIds);
  const rows = subscribers.map((subscriber) => buildRow(subscriber, tagLookup));

  if (output.isJson()) {
    output.json({
      success: true,
      error: null,
      data: rows.map((row) => ({
        email: row.email,
        uuid: row.uuid,
        name: row.name,
        status: row.status,
        tags: row.tags,
        fields: row.fields,
      })),
      meta: { count: rows.length },
    });
    return;
  }

  output.table(
    rows.map((row) => ({
      email: row.email,
      name: row.name,
      status: row.status,
      tags: row.tagSummary,
      fields: row.fieldsSummary,
    })),
    {
      columns: [
        { key: "email", header: "EMAIL", width: 25 },
        { key: "name", header: "NAME", width: 15 },
        { key: "status", header: "STATUS", width: 12 },
        { key: "tags", header: "TAGS", width: 30 },
        { key: "fields", header: "FIELDS", width: 25 },
      ],
      emptyMessage: "No subscribers found.",
    }
  );
}

function buildRow(
  subscriber: Subscriber<Record<string, unknown>>,
  tagLookup: Map<string, string>
): SubscriberRow {
  const fields = subscriber.attributes.fields ?? {};
  const tags = (subscriber.attributes.cached_tag_ids ?? []).map((id) => tagLookup.get(id) ?? id);
  const name = deriveName(fields);
  const status = subscriber.attributes.unsubscribed_at ? "unsubscribed" : "active";

  return {
    email: subscriber.attributes.email,
    uuid: subscriber.attributes.uuid,
    name,
    status,
    tags,
    tagSummary: tags.length ? tags.join(", ") : "-",
    fields,
    fieldsSummary: summarizeFields(fields),
  };
}

function deriveName(fields: Record<string, unknown>): string {
  const candidates = ["name", "full_name", "fullName", "first_name", "firstName"];
  for (const key of candidates) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function summarizeFields(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields).filter(
    ([, value]) => typeof value !== "undefined" && value !== null && String(value).trim() !== ""
  );
  if (entries.length === 0) {
    return "";
  }

  const summary = entries
    .slice(0, 3)
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .join(", ");

  if (entries.length > 3) {
    return `${summary} +${entries.length - 3} more`;
  }

  return summary;
}
