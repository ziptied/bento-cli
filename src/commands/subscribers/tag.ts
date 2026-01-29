import type { Command } from "commander";

import { output } from "../../core/output";
import { Safety, safety } from "../../core/safety";
import { bento } from "../../core/sdk";
import { handleSubscriberError, printCsvErrors, resolveEmailTargets } from "./helpers";

interface TagOptions {
  email?: string;
  file?: string;
  add?: string[];
  remove?: string[];
  dryRun?: boolean;
  limit?: string;
  sample?: string;
  confirm?: boolean;
}

export function registerTagCommand(subscribers: Command): void {
  const command = subscribers
    .command("tag")
    .description("Add or remove tags from subscribers")
    .option("-e, --email <email>", "Single email to update")
    .option("-f, --file <file>", "CSV or newline list of subscriber emails")
    .option("--add <tags...>", "Tags to add (repeat or comma-separate)")
    .option("--remove <tags...>", "Tags to remove (repeat or comma-separate)");

  Safety.addFlags(command);

  command.action(async (opts: TagOptions) => {
    try {
      const addTags = normalizeTagList(opts.add);
      const removeTags = normalizeTagList(opts.remove);

      if (!addTags.length && !removeTags.length) {
        output.error("Specify --add and/or --remove tags.");
        process.exit(2);
      }

      const targets = await resolveEmailTargets({ email: opts.email, file: opts.file });
      if (!targets) {
        output.error("Provide --email <email> or --file <path> to select subscribers.");
        process.exit(2);
      }

      if (targets.errors.length > 0) {
        printCsvErrors(targets.errors);
        process.exit(6);
      }

      const actionName = buildActionName(addTags, removeTags);

      await safety.protect<string, void>(
        {
          name: actionName,
          items: targets.emails,
          formatItem: (email) => ({
            email,
            add: addTags.join(", "),
            remove: removeTags.join(", "),
          }),
          execute: async (emails) => {
            await applyTagMutations(emails, addTags, removeTags);
            emitTagResult(emails.length, addTags, removeTags);
          },
        },
        Safety.parseOptions(opts)
      );
    } catch (error) {
      handleSubscriberError(error);
    }
  });
}

function normalizeTagList(values?: string[]): string[] {
  if (!values) return [];
  const tags = values
    .flatMap((entry) => entry.split(","))
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

async function applyTagMutations(emails: string[], add: string[], remove: string[]): Promise<void> {
  for (const email of emails) {
    for (const tagName of add) {
      await bento.addTag(email, tagName);
    }
    for (const tagName of remove) {
      await bento.removeTag(email, tagName);
    }
  }
}

function buildActionName(add: string[], remove: string[]): string {
  if (add.length && remove.length) return "Add/Remove Subscriber Tags";
  if (add.length) return "Add Tags to Subscribers";
  return "Remove Tags from Subscribers";
}

function emitTagResult(count: number, add: string[], remove: string[]): void {
  if (output.isJson()) {
    output.json({
      success: true,
      error: null,
      data: {
        updated: count,
        added: add,
        removed: remove,
      },
      meta: { count },
    });
    return;
  }

  const parts: string[] = [];
  if (add.length) {
    parts.push(`added ${formatTagList(add)}`);
  }
  if (remove.length) {
    parts.push(`removed ${formatTagList(remove)}`);
  }

  const detail = parts.length ? ` (${parts.join(" & ")})` : "";
  output.success(`Updated ${count} subscriber(s)${detail}.`);
}

function formatTagList(tags: string[]): string {
  return tags.map((tag) => `"${tag}"`).join(", ");
}
