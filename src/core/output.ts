/**
 * Output formatting utilities
 *
 * All command output should go through this module to ensure:
 * - Consistent formatting across commands
 * - Support for --json and --quiet flags
 * - Scriptable output that won't break
 *
 * Output patterns:
 * - Default: Human-readable tables
 * - --json: Machine-readable JSON
 * - --quiet: Minimal output (errors only)
 */

export interface OutputOptions {
  json?: boolean;
  quiet?: boolean;
}

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
}

export interface JsonResponse<T = unknown> {
  success: boolean;
  error: string | null;
  data: T;
  count?: number;
  total?: number;
}

let currentOptions: OutputOptions = {};

export function setOptions(options: OutputOptions): void {
  currentOptions = options;
}

/**
 * Output success message
 * Pattern: {Action} {count} {resource}(s){context}
 */
export function success(message: string): void {
  if (currentOptions.quiet) return;
  if (currentOptions.json) return;
  console.log(message);
}

/**
 * Output info message
 */
export function info(message: string): void {
  if (currentOptions.quiet) return;
  if (currentOptions.json) return;
  console.log(message);
}

/**
 * Output warning message
 */
export function warn(message: string): void {
  if (currentOptions.json) return;
  console.error(`Warning: ${message}`);
}

/**
 * Output error message
 * Pattern: {What failed}: {Why}{. How to fix}
 */
export function error(message: string): void {
  if (currentOptions.json) return;
  console.error(`Error: ${message}`);
}

/**
 * Output data as table or JSON depending on options
 */
export function data<T>(items: T[], columns: TableColumn[], meta?: { total?: number }): void {
  if (currentOptions.json) {
    const response: JsonResponse<T[]> = {
      success: true,
      error: null,
      data: items,
      count: items.length,
      total: meta?.total ?? items.length,
    };
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  if (currentOptions.quiet) return;

  // Print table header
  const headers = columns.map((col) => col.header.padEnd(col.width ?? 20));
  console.log(headers.join("  "));

  // Print rows
  for (const item of items) {
    const row = columns.map((col) => {
      const value = String((item as Record<string, unknown>)[col.key] ?? "");
      const width = col.width ?? 20;
      return value.length > width ? `${value.slice(0, width - 3)}...` : value.padEnd(width);
    });
    console.log(row.join("  "));
  }

  // Print summary
  console.log("");
  console.log(`Showing ${items.length} of ${meta?.total ?? items.length} items`);
}

/**
 * Output JSON response directly (for errors in JSON mode)
 */
export function json<T>(response: JsonResponse<T>): void {
  console.log(JSON.stringify(response, null, 2));
}

/**
 * Output error as JSON
 */
export function jsonError(message: string): void {
  const response: JsonResponse<null> = {
    success: false,
    error: message,
    data: null,
  };
  console.log(JSON.stringify(response, null, 2));
}
