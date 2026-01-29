import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { output } from "../../core/output";
import { CLIError, bento } from "../../core/sdk";
import type { SDKErrorCode } from "../../types/sdk";
import type { CSVErrorDetail, EmailListParseResult } from "../../utils/csv";
import { isValidEmail, normalizeEmail, parseEmailList } from "../../utils/csv";

const exitCodeMap: Record<SDKErrorCode, number> = {
  AUTH_REQUIRED: 3,
  AUTH_FAILED: 3,
  RATE_LIMITED: 4,
  NOT_FOUND: 4,
  TIMEOUT: 4,
  VALIDATION_ERROR: 6,
  API_ERROR: 4,
  UNKNOWN: 1,
};

export function handleSubscriberError(error: unknown): never {
  if (error instanceof CLIError) {
    output.error(error.message);
    process.exit(exitCodeMap[error.code] ?? 1);
  }

  if (error instanceof Error) {
    output.error(error.message);
    process.exit(1);
  }

  output.error("An unexpected error occurred.");
  process.exit(1);
}

export function printCsvErrors(errors: CSVErrorDetail[], max = 5): void {
  if (errors.length === 0) {
    return;
  }

  output.error("CSV validation errors:");
  for (const err of errors.slice(0, max)) {
    const location = err.column ? `${err.column} (line ${err.line})` : `line ${err.line}`;
    const valueInfo = err.value ? ` - ${err.value}` : "";
    output.error(`  ${location}: ${err.message}${valueInfo}`);
  }

  if (errors.length > max) {
    output.error(`  ...and ${errors.length - max} more error(s)`);
  }
}

export async function ensureFileExists(filePath: string): Promise<string> {
  const fullPath = resolve(filePath);
  try {
    await access(fullPath);
    return fullPath;
  } catch (error) {
    const label = basename(filePath);
    if (error instanceof Error) {
      output.error(`Cannot read ${label}: ${error.message}`);
    } else {
      output.error(`Cannot read ${label}.`);
    }
    process.exit(5);
  }
}

export function requireAtLeastOneFilter(condition: boolean, message: string): void {
  if (condition) return;
  output.error(message);
  process.exit(2);
}

export async function resolveEmailTargets(options: {
  email?: string;
  file?: string;
}): Promise<{ emails: string[]; errors: CSVErrorDetail[] } | null> {
  if (options.email) {
    const trimmed = options.email.trim();
    if (!trimmed) {
      output.error("Email cannot be empty.");
      process.exit(2);
    }

    if (!isValidEmail(trimmed)) {
      output.error(`Invalid email: ${trimmed}`);
      process.exit(2);
    }

    return { emails: [normalizeEmail(trimmed)], errors: [] };
  }

  if (options.file) {
    const filePath = await ensureFileExists(options.file);

    try {
      const result: EmailListParseResult = await parseEmailList(filePath);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        output.error(`Failed to read ${options.file}: ${error.message}`);
      } else {
        output.error(`Failed to read ${options.file}.`);
      }
      process.exit(5);
    }
  }

  return null;
}

export async function lookupTagNames(tagIds: Set<string>): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();
  if (tagIds.size === 0) return lookup;

  try {
    const tags = await bento.getTags();
    if (!tags) return lookup;

    for (const tag of tags) {
      lookup.set(tag.id, tag.attributes.name);
    }
  } catch {
    // Ignore tag lookup failures – fall back to IDs
  }

  return lookup;
}
