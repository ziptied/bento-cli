import { confirm } from "@inquirer/prompts";
import type { Command } from "commander";

import { output } from "./output";
import type { BulkOperation, SafetyConfig, SafetyOptions } from "../types/safety";

type ConfirmPrompt = typeof confirm;
type InteractiveCheck = () => boolean;

const DEFAULT_CONFIG: SafetyConfig = {
  confirmThreshold: 10,
  defaultSampleSize: 5,
};

const AUTO_CONFIRM_ENV = "BENTO_AUTO_CONFIRM";

function coercePositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric <= 0) return undefined;
  return Math.floor(numeric);
}

function isTruthyEnv(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

export class Safety {
  private config: SafetyConfig;
  private readonly confirmPrompt: ConfirmPrompt;
  private readonly interactiveCheck: InteractiveCheck;

  constructor(
    config: Partial<SafetyConfig> = {},
    confirmFn: ConfirmPrompt = confirm,
    interactiveFn: InteractiveCheck = () => Boolean(process.stdout.isTTY),
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.confirmPrompt = confirmFn;
    this.interactiveCheck = interactiveFn;
  }

  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  static parseOptions(opts: Record<string, unknown>): SafetyOptions {
    return {
      dryRun: Boolean(opts.dryRun),
      limit: coercePositiveInteger(opts.limit),
      sample: coercePositiveInteger(opts.sample),
      confirm: Boolean(opts.confirm),
    };
  }

  static addFlags<T extends Command>(command: T): T {
    return command
      .option("--dry-run", "Preview changes without executing")
      .option("--limit <n>", "Limit the operation to N items", (value: string) => Number.parseInt(value, 10))
      .option("--sample <n>", "Show N sample items in the preview", (value: string) => Number.parseInt(value, 10))
      .option("--confirm", "Skip confirmation prompts");
  }

  async protect<T, R>(operation: BulkOperation<T, R>, options: SafetyOptions): Promise<R | null> {
    let items = [...operation.items];
    const originalCount = items.length;

    if (originalCount === 0) {
      this.emitNoWork(operation.name);
      return null;
    }

    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, originalCount) : undefined;
    if (limit && limit < originalCount) {
      output.info(`Limiting ${operation.name} to ${limit} of ${originalCount} item(s).`);
      items = items.slice(0, limit);
    }

    const count = items.length;
    const sampleSize = this.resolveSampleSize(options.sample, count);
    const sampleItems = items.slice(0, sampleSize);
    const formattedSample = this.formatSample(operation, sampleItems);

    await this.renderPreview(operation, {
      count,
      sampleItems,
      formattedSample,
    });

    if (options.dryRun) {
      this.emitDryRun(operation, formattedSample, count);
      return null;
    }

    if (this.shouldPrompt(count, options, operation)) {
      if (!this.canPrompt()) {
        this.emitPromptUnavailable(operation.name);
        return null;
      }

      const confirmed = await this.confirmPrompt({
        message: `Proceed with ${operation.name} on ${count} item(s)?`,
        default: false,
      });

      if (!confirmed) {
        this.emitCancelled();
        return null;
      }
    }

    output.startSpinner(`Executing ${operation.name}...`);

    try {
      const result = await operation.execute(items);
      output.stopSpinner(`${operation.name} complete`);
      return result;
    } catch (error) {
      output.failSpinner(`${operation.name} failed`);
      throw error;
    }
  }

  async confirmAction(message: string, options: { confirm: boolean }): Promise<boolean> {
    if (options.confirm || this.autoConfirmEnabled()) {
      return true;
    }

    if (!this.canPrompt()) {
      this.emitPromptUnavailable("operation");
      return false;
    }

    return this.confirmPrompt({ message, default: false });
  }

  private resolveSampleSize(requested: number | undefined, total: number): number {
    if (total === 0) return 0;
    const fallback = Math.min(this.config.defaultSampleSize, total);
    if (!requested) return fallback;
    if (requested <= 0) return fallback;
    return Math.min(requested, total);
  }

  private formatSample<T>(operation: BulkOperation<T, unknown>, sample: T[]): Record<string, unknown>[] {
    if (operation.formatItem) {
      return sample.map((item, index) => operation.formatItem!(item, index));
    }

    return sample.map((item, index) => {
      if (item && typeof item === "object") {
        return item as Record<string, unknown>;
      }
      return { index, value: String(item) };
    });
  }

  private async renderPreview<T>(
    operation: BulkOperation<T, unknown>,
    context: { count: number; sampleItems: T[]; formattedSample: Record<string, unknown>[] },
  ): Promise<void> {
    if (output.isQuiet()) return;
    if (output.isJson()) return;

    if (operation.isDangerous) {
      output.warn("This operation cannot be undone. Use --dry-run to preview and --confirm to skip prompts.");
    }

    output.info(`${operation.name}: ${context.count} item(s)`);

    if (context.formattedSample.length > 0) {
      output.table(context.formattedSample, {
        meta: { total: context.count },
        emptyMessage: "No matching records to preview.",
      });
    } else {
      output.info("No matching records to preview.");
    }

    if (context.count > context.formattedSample.length) {
      const previewed = context.formattedSample.length;
      output.info(`Previewing ${previewed} of ${context.count} item(s). Use --sample to change the sample size.`);
    }

    if (operation.preview) {
      await operation.preview(context.sampleItems);
    }
  }

  private emitDryRun(
    operation: BulkOperation<unknown, unknown>,
    sample: Record<string, unknown>[],
    count: number,
  ): void {
    if (output.isJson()) {
      output.json({
        success: true,
        error: null,
        data: {
          dryRun: true,
          action: operation.name,
          wouldAffect: count,
          preview: sample,
        },
        meta: { count },
      });
      return;
    }

    output.info("Dry run complete. No changes were made.");
  }

  private emitNoWork(name: string): void {
    if (output.isQuiet()) return;
    if (output.isJson()) {
      output.json({
        success: true,
        error: null,
        data: {
          dryRun: true,
          action: name,
          wouldAffect: 0,
          preview: [],
        },
        meta: { count: 0 },
      });
      return;
    }

    output.warn(`No items found for ${name}. Nothing to do.`);
  }

  private emitPromptUnavailable(name: string): void {
    const message = `Cannot run ${name} without --confirm in non-interactive mode. Re-run with --confirm or set ${AUTO_CONFIRM_ENV}=true.`;

    if (output.isJson()) {
      output.json({
        success: false,
        error: message,
        data: null,
        meta: { code: 6 },
      });
      return;
    }

    output.warn(message);
  }

  private emitCancelled(): void {
    if (output.isJson()) {
      output.json({
        success: true,
        error: null,
        data: {
          cancelled: true,
        },
        meta: { count: 0 },
      });
      return;
    }

    output.warn("Operation cancelled.");
  }

  private canPrompt(): boolean {
    return this.isInteractive() && !this.autoConfirmEnabled();
  }

  private shouldPrompt(count: number, options: SafetyOptions, operation: BulkOperation<unknown, unknown>): boolean {
    if (options.confirm) return false;
    if (this.autoConfirmEnabled()) return false;
    if (!this.isInteractive()) return true;
    if (operation.isDangerous) return true;
    return count >= this.config.confirmThreshold;
  }

  private isInteractive(): boolean {
    return this.interactiveCheck();
  }

  private autoConfirmEnabled(): boolean {
    return isTruthyEnv(process.env[AUTO_CONFIRM_ENV]);
  }
}

export const safety = new Safety();
