import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

export interface CSVErrorDetail {
  line: number;
  column?: string;
  message: string;
  value?: string;
}

export interface SubscriberCSVRecord {
  email: string;
  name?: string;
  tags?: string[];
  fields?: Record<string, string>;
}

export interface SubscriberCSVParseResult {
  records: SubscriberCSVRecord[];
  errors: CSVErrorDetail[];
}

export interface EmailListParseResult {
  emails: string[];
  errors: CSVErrorDetail[];
}

interface ParsedRow {
  [key: string]: string | undefined;
}

export async function parseSubscriberCSV(filePath: string): Promise<SubscriberCSVParseResult> {
  const content = await readFile(filePath, "utf-8");
  let rows: ParsedRow[] = [];

  try {
    rows = parse(content, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ParsedRow[];
  } catch (error) {
    throw wrapCsvError(error);
  }

  const errors: CSVErrorDetail[] = [];
  const records: SubscriberCSVRecord[] = [];

  if (rows.length === 0) {
    return { records, errors };
  }

  const headerKeys = Object.keys(rows[0]);
  const emailKey = findColumnKey(headerKeys, "email");

  if (!emailKey) {
    errors.push({
      line: 1,
      column: "email",
      message: "CSV missing required column 'email'",
    });
    return { records, errors };
  }

  const nameKey = findColumnKey(headerKeys, "name");
  const tagsKey = findColumnKey(headerKeys, "tags");

  rows.forEach((row, index) => {
    const lineNumber = index + 2;
    const rawEmail = row[emailKey]?.trim() ?? "";

    if (!rawEmail) {
      errors.push({
        line: lineNumber,
        column: emailKey,
        message: "Missing email",
      });
      return;
    }

    if (!isValidEmail(rawEmail)) {
      errors.push({
        line: lineNumber,
        column: emailKey,
        message: "Invalid email format",
        value: rawEmail,
      });
      return;
    }

    const record: SubscriberCSVRecord = {
      email: normalizeEmail(rawEmail),
    };

    const rawName = nameKey ? row[nameKey]?.trim() : undefined;
    if (rawName) {
      record.name = rawName;
    }

    if (tagsKey) {
      const rawTags = row[tagsKey];
      if (rawTags) {
        const tags = rawTags
          .split(/[,;]/)
          .map((tag) => tag.trim())
          .filter(Boolean);
        if (tags.length > 0) {
          record.tags = tags;
        }
      }
    }

    const fields: Record<string, string> = {};
    for (const [column, value] of Object.entries(row)) {
      if (!value) continue;
      const normalizedColumn = column.trim();
      if (!normalizedColumn) continue;
      if (equalsColumn(column, emailKey) || equalsColumn(column, nameKey) || equalsColumn(column, tagsKey)) {
        continue;
      }

      fields[normalizedColumn] = String(value).trim();
    }

    if (Object.keys(fields).length > 0) {
      record.fields = fields;
    }

    records.push(record);
  });

  return { records, errors };
}

export async function parseEmailList(filePath: string): Promise<EmailListParseResult> {
  const content = await readFile(filePath, "utf-8");
  const errors: CSVErrorDetail[] = [];
  const emails = new Set<string>();

  const csvResult = tryParseEmailCSV(content);
  if (csvResult) {
    csvResult.rows.forEach((row, index) => {
      const lineNumber = index + 2;
      const rawEmail = row[csvResult.emailKey]?.trim() ?? "";

      if (!rawEmail) {
        errors.push({
          line: lineNumber,
          column: csvResult.emailKey,
          message: "Missing email",
        });
        return;
      }

      if (!isValidEmail(rawEmail)) {
        errors.push({
          line: lineNumber,
          column: csvResult.emailKey,
          message: "Invalid email format",
          value: rawEmail,
        });
        return;
      }

      emails.add(normalizeEmail(rawEmail));
    });

    return { emails: Array.from(emails), errors };
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      errors.push({
        line: index + 1,
        message: "Invalid email format",
        value: trimmed,
      });
      return;
    }

    emails.add(normalizeEmail(trimmed));
  });

  return { emails: Array.from(emails), errors };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function findColumnKey(columns: string[], target: string): string | undefined {
  const lowered = target.toLowerCase();
  return columns.find((column) => column.trim().toLowerCase() === lowered);
}

function equalsColumn(actual?: string, expected?: string): boolean {
  if (!actual || !expected) return false;
  return actual.trim().toLowerCase() === expected.trim().toLowerCase();
}

function wrapCsvError(error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`CSV parse error: ${error.message}`);
  }
  return new Error("CSV parse error");
}

function tryParseEmailCSV(content: string): { rows: ParsedRow[]; emailKey: string } | null {
  let rows: ParsedRow[] = [];
  try {
    rows = parse(content, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ParsedRow[];
  } catch {
    return null;
  }

  if (rows.length === 0) {
    return null;
  }

  const emailKey = findColumnKey(Object.keys(rows[0]), "email");
  if (!emailKey) {
    return null;
  }

  return { rows, emailKey };
}
