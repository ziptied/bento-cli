import type { Command } from "commander";

import { output } from "../../core/output";
import { bento } from "../../core/sdk";
import type { FieldFilter, Subscriber, SubscriberSearchParams } from "../../types/sdk";
import { handleSubscriberError, lookupTagNames, requireAtLeastOneFilter } from "./helpers";

interface SearchCommandOptions {
  email?: string;
  tag?: string;
  field?: string[];
  page?: string;
  perPage?: string;
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
    .description("Search for subscribers by email, tag, or custom field")
    .option("-e, --email <email>", "Filter by email (exact match)")
    .option("-t, --tag <tag>", "Filter by tag name")
    .option(
      "-f, --field <key=value>",
      "Filter by custom field (repeat flag for multiple fields)",
      collectFieldOptions,
      []
    )
    .option("--uuid <uuid>", "Lookup a subscriber by UUID")
    .option("--page <n>", "Page number (default: 1)", "1")
    .option("--per-page <n>", "Results per page (default: 25)", "25")
    .action(async (options: SearchCommandOptions) => {
      const page = parsePositiveInteger(options.page ?? "1", "--page");
      const perPage = parsePositiveInteger(options.perPage ?? "25", "--per-page");
      const fieldFilters = parseFieldFilters(options.field ?? []);
      const email = options.email?.trim() || undefined;
      const uuid = options.uuid?.trim() || undefined;
      const tag = options.tag?.trim() || undefined;

      requireAtLeastOneFilter(Boolean(email || uuid || tag || fieldFilters.length > 0), "Provide --email, --uuid, --tag, or --field to search.");

      const params: SubscriberSearchParams = {
        email,
        uuid,
        tag,
        fields: fieldFilters.length ? fieldFilters : undefined,
        page,
        perPage,
      };

      output.startSpinner("Searching subscribers...");

      try {
        const result = await bento.searchSubscribers(params);
        output.stopSpinner();
        await renderResults(result.subscribers, result.meta);
      } catch (error) {
        output.failSpinner();
        handleSubscriberError(error);
      }
    });
}

function collectFieldOptions(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInteger(value: string, flag: string): number {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    output.error(`${flag} must be a positive integer.`);
    process.exit(2);
  }
  return numeric;
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

async function renderResults(subscribers: Subscriber<Record<string, unknown>>[], meta: SubscriberSearchParams["meta"] extends never
  ? { page: number; perPage: number; total?: number; count: number; hasMore?: boolean }
  : never): Promise<void> {
  const tagIds = new Set<string>();
  subscribers.forEach((subscriber) => {
    const ids = subscriber.attributes.cached_tag_ids ?? [];
    ids.forEach((id) => {
      if (id) tagIds.add(id);
    });
  });

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
      meta: {
        count: rows.length,
        total: meta.total ?? rows.length,
        page: meta.page,
        pageSize: meta.perPage,
        hasMore: meta.hasMore ?? false,
      },
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
        { key: "email", header: "EMAIL" },
        { key: "name", header: "NAME" },
        { key: "status", header: "STATUS" },
        { key: "tags", header: "TAGS" },
        { key: "fields", header: "FIELDS" },
      ],
      emptyMessage: "No subscribers found.",
      meta: { total: meta.total },
    }
  );

  if (!output.isQuiet()) {
    const totalText = typeof meta.total === "number" ? ` of ${meta.total}` : "";
    const moreText = meta.hasMore ? " (more available)" : "";
    output.info(`Page ${meta.page}, showing ${rows.length}${totalText}${moreText}`);
  }
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
  const entries = Object.entries(fields).filter(([, value]) => typeof value !== "undefined" && value !== null && String(value).trim() !== "");
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
