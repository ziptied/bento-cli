/**
 * Field management commands
 *
 * Commands:
 * - bento fields list - List all custom fields
 * - bento fields create <key> - Create a new custom field
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";
import { filterBySearch } from "../utils/search";

export function registerFieldsCommands(program: Command): void {
  const fields = program.command("fields").description("Manage custom fields");

  fields
    .command("list")
    .description("List all custom fields")
    .argument("[search]", "Filter fields by key or name")
    .action(async (search?: string) => {
      output.startSpinner("Fetching fields...");

      try {
        const result = await bento.getFields();
        output.stopSpinner();

        if (!result || result.length === 0) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: [],
              meta: { count: 0 },
            });
          } else {
            output.info(
              "No custom fields found. Create one with `bento fields create <key>`"
            );
          }
          return;
        }

        const filtered = filterBySearch(result, search, (field) => [
          field.attributes.key,
          field.attributes.name ?? "",
        ]);

        if (filtered.length === 0) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: [],
              meta: { count: 0, total: result.length },
            });
          } else {
            output.info(`No fields found matching "${search}"`);
          }
          return;
        }

        output.table(
          filtered.map((field) => ({
            key: field.attributes.key,
            name: field.attributes.name ?? field.attributes.key,
            id: field.id,
            createdAt: formatDate(field.attributes.createdAt),
          })),
          {
            columns: [
              { key: "key", header: "KEY" },
              { key: "name", header: "NAME" },
              { key: "id", header: "ID" },
              { key: "createdAt", header: "CREATED" },
            ],
            emptyMessage: "No custom fields found.",
          }
        );

        if (search && filtered.length < result.length) {
          output.info(`Showing ${filtered.length} of ${result.length} fields`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  fields
    .command("create")
    .description("Create a new custom field")
    .argument("<key>", "Key for the field (used in API, e.g., company_name)")
    .action(async (key: string) => {
      const trimmedKey = key.trim();

      if (!trimmedKey) {
        output.error("Field key cannot be empty.");
        process.exit(1);
      }

      // Validate key format - should be snake_case or similar
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmedKey)) {
        output.error(
          "Field key must start with a letter and contain only letters, numbers, and underscores."
        );
        process.exit(1);
      }

      output.startSpinner(`Creating field "${trimmedKey}"...`);

      try {
        const result = await bento.createField(trimmedKey);
        output.stopSpinner();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result ? { key: trimmedKey, fields: result } : { key: trimmedKey },
            meta: { count: 1 },
          });
        } else {
          output.success(`Field "${trimmedKey}" created`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error, trimmedKey);
      }
    });
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Handle errors with user-friendly messages
 */
function handleError(error: unknown, fieldKey?: string): never {
  if (error instanceof CLIError) {
    if (error.code === "VALIDATION_ERROR" && fieldKey) {
      output.error(`Failed to create field "${fieldKey}": ${error.message}`);
    } else {
      output.error(error.message);
    }
  } else if (error instanceof Error) {
    output.error(error.message);
  } else {
    output.error("An unexpected error occurred.");
  }
  process.exit(1);
}
