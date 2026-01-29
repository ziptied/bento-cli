/**
 * Tag management commands
 *
 * Commands:
 * - bento tags list - List all tags
 * - bento tags create <name> - Create a new tag
 * - bento tags delete <name> - Delete a tag (dangerous, requires confirmation)
 */

import { Command } from "commander";
import { bento, CLIError } from "../core/sdk";
import { output } from "../core/output";
import { safety } from "../core/safety";

export function registerTagsCommands(program: Command): void {
  const tags = program.command("tags").description("Manage tags");

  tags
    .command("list")
    .description("List all tags")
    .action(async () => {
      output.startSpinner("Fetching tags...");

      try {
        const result = await bento.getTags();
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
            output.info("No tags found. Create one with `bento tags create <name>`");
          }
          return;
        }

        output.table(
          result.map((tag) => ({
            name: tag.attributes.name,
            id: tag.id,
            createdAt: formatDate(tag.attributes.createdAt),
          })),
          {
            columns: [
              { key: "name", header: "NAME" },
              { key: "id", header: "ID" },
              { key: "createdAt", header: "CREATED" },
            ],
            emptyMessage: "No tags found.",
          }
        );
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });

  tags
    .command("create")
    .description("Create a new tag")
    .argument("<name>", "Name of the tag to create")
    .action(async (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        output.error("Tag name cannot be empty.");
        process.exit(1);
      }

      output.startSpinner(`Creating tag "${trimmedName}"...`);

      try {
        const result = await bento.createTag(trimmedName);
        output.stopSpinner();

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: result ? { name: trimmedName, tags: result } : { name: trimmedName },
            meta: { count: 1 },
          });
        } else {
          output.success(`Tag "${trimmedName}" created`);
        }
      } catch (error) {
        output.failSpinner();
        handleError(error, trimmedName);
      }
    });

  tags
    .command("delete")
    .description("Delete a tag")
    .argument("<name>", "Name of the tag to delete")
    .option("--confirm", "Skip confirmation prompt")
    .action(async (name: string, opts: { confirm?: boolean }) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        output.error("Tag name cannot be empty.");
        process.exit(1);
      }

      // Deleting tags is a dangerous operation - requires confirmation
      const confirmed = await safety.confirmAction(
        `Delete tag "${trimmedName}"? This cannot be undone and will remove the tag from all subscribers.`,
        { confirm: opts.confirm ?? false }
      );

      if (!confirmed) {
        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: { cancelled: true },
            meta: { count: 0 },
          });
        } else {
          output.warn("Cancelled.");
        }
        return;
      }

      output.startSpinner(`Deleting tag "${trimmedName}"...`);

      try {
        // Note: The Bento SDK doesn't have a direct deleteTag method
        // This would need to be implemented if the API supports it
        // For now, we throw a clear error message
        output.failSpinner();
        output.error(
          "Tag deletion is not currently supported by the Bento API. " +
            "Please delete tags through the Bento dashboard."
        );
        process.exit(1);
      } catch (error) {
        output.failSpinner();
        handleError(error);
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
function handleError(error: unknown, tagName?: string): never {
  if (error instanceof CLIError) {
    if (error.code === "VALIDATION_ERROR" && tagName) {
      output.error(`Failed to process tag "${tagName}": ${error.message}`);
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
