/**
 * Safety utilities for bulk operations
 *
 * Implements the "Safe Productivity" philosophy:
 * - No user should be surprised by what a bulk operation did
 * - Dangerous operations require explicit validation
 *
 * Dangerous operations (always require confirmation):
 * - Deleting subscribers, tags, or any data
 * - Sending broadcasts or emails
 * - Bulk imports that overwrite existing data
 *
 * Safe operations (standard flow):
 * - Adding/removing tags from subscribers
 * - Creating tags, fields
 * - Tracking events
 * - Suppressing subscribers (reversible)
 * - Read-only operations
 */

export interface SafetyOptions {
  dryRun?: boolean;
  limit?: number;
  sample?: boolean;
  confirm?: boolean;
}

export interface BulkOperationPreview {
  action: string;
  count: number;
  sample?: unknown[];
  isDangerous: boolean;
}

/**
 * Check if the operation should proceed based on safety options
 */
export function shouldProceed(options: SafetyOptions, isDangerous: boolean): boolean {
  // Dry run never proceeds with actual execution
  if (options.dryRun) {
    return false;
  }

  // Dangerous operations require explicit confirmation
  if (isDangerous && !options.confirm) {
    return false;
  }

  return true;
}

/**
 * Generate a preview message for bulk operations
 */
export function formatPreview(preview: BulkOperationPreview): string {
  const lines: string[] = [];

  if (preview.isDangerous) {
    lines.push("WARNING: This is a destructive operation.");
  }

  lines.push(`${preview.action}: ${preview.count} record(s)`);

  if (preview.sample && preview.sample.length > 0) {
    lines.push("");
    lines.push("Sample:");
    for (const item of preview.sample.slice(0, 5)) {
      lines.push(`  ${JSON.stringify(item)}`);
    }
    if (preview.sample.length > 5) {
      lines.push(`  ... and ${preview.sample.length - 5} more`);
    }
  }

  return lines.join("\n");
}

/**
 * Prompt for confirmation (interactive)
 */
export async function promptConfirmation(_message: string): Promise<boolean> {
  // TODO: Implement interactive prompt
  // For now, return false to require --confirm flag
  return false;
}
