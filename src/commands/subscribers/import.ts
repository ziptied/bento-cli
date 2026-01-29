import type { Command } from "commander";

import { output } from "../../core/output";
import { Safety, safety } from "../../core/safety";
import { bento } from "../../core/sdk";
import type { ImportSubscribersParams } from "../../types/sdk";
import type { SubscriberCSVRecord } from "../../utils/csv";
import { parseSubscriberCSV } from "../../utils/csv";
import { ensureFileExists, handleSubscriberError, printCsvErrors } from "./helpers";

interface ImportOptions {
  dryRun?: boolean;
  limit?: string;
  sample?: string;
  confirm?: boolean;
}

export function registerImportCommand(subscribers: Command): void {
  const command = subscribers
    .command("import")
    .argument("<file>", "CSV file containing subscribers")
    .description("Import subscribers from CSV (email required column)")
    .allowExcessArguments(false);

  Safety.addFlags(command);

  command.action(async (file: string, opts: ImportOptions) => {
    try {
      const resolved = await ensureFileExists(file);
      const safetyOptions = Safety.parseOptions(opts);

      let parseResult: Awaited<ReturnType<typeof parseSubscriberCSV>>;
      try {
        parseResult = await parseSubscriberCSV(resolved);
      } catch (error) {
        if (error instanceof Error) {
          output.error(error.message);
        } else {
          output.error("CSV parse error.");
        }
        process.exit(5);
      }

      const { records, errors } = parseResult;

      if (errors.length > 0) {
        printCsvErrors(errors);
        process.exit(6);
      }

      await safety.protect<SubscriberCSVRecord, void>(
        {
          name: "Import Subscribers",
          items: records,
          formatItem: (item) => ({
            email: item.email,
            name: item.name ?? "",
            tags: item.tags?.join(", ") ?? "",
            remove_tags: item.remove_tags?.join(", ") ?? "",
          }),
          isDangerous: true,
          preview: async () => {
            if (!output.isJson() && !output.isQuiet()) {
              output.info("Review the preview carefully. Use --confirm to skip prompts.");
            }
          },
          execute: async (items) => {
            const payload: ImportSubscribersParams = {
              subscribers: items.map((item) => ({
                email: item.email,
                ...(item.name ? { name: item.name } : {}),
                ...(item.fields ?? {}),
                ...(item.tags ? { tags: item.tags.join(",") } : {}),
                ...(item.remove_tags ? { remove_tags: item.remove_tags.join(",") } : {}),
              })),
            };

            await bento.importSubscribers(payload);
            emitSuccess(items.length);
          },
        },
        safetyOptions
      );
    } catch (error) {
      handleSubscriberError(error);
    }
  });
}

function emitSuccess(count: number): void {
  if (output.isJson()) {
    output.json({
      success: true,
      error: null,
      data: { imported: count },
      meta: { count },
    });
    return;
  }

  output.success(`Imported ${count} subscriber(s).`);
}
