import chalk from "chalk";
import ora, { type Ora } from "ora";
import ttyTable from "tty-table";

import type {
  CLIResponse,
  OutputMode,
  ProgressBarHandle,
  ProgressBarOptions,
  TableColumn,
  TableOptions,
} from "../types/output";

const DIVIDER = "-".repeat(40);
const noopProgressBar: ProgressBarHandle = {
  update: () => {},
  increment: () => {},
  stop: () => {},
};

type OraFactory = typeof ora;

class TextProgressBar implements ProgressBarHandle {
  private current = 0;
  private label: string;
  private active = true;
  private readonly width: number;

  constructor(private total: number, options: ProgressBarOptions = {}) {
    this.label = options.label ?? "";
    this.width = Math.max(10, Math.min(options.width ?? 24, 60));
    this.render();
  }

  update(completed: number, label?: string): void {
    if (!this.active) return;
    this.current = Math.max(0, Math.min(completed, this.total));
    if (label !== undefined) this.label = label;
    this.render();
  }

  increment(step = 1, label?: string): void {
    this.update(this.current + step, label);
  }

  stop(message?: string): void {
    if (!this.active) return;
    this.current = this.total;
    this.render(true);
    this.active = false;
    if (message) {
      console.log(message);
    }
  }

  private render(final = false): void {
    const ratio = this.total === 0 ? 1 : this.current / this.total;
    const filled = Math.min(this.width, Math.round(ratio * this.width));
    const empty = this.width - filled;
    const bar = `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
    const percent = `${Math.min(100, Math.round(ratio * 100))}%`.padStart(4);
    const labelText = this.label ? ` ${this.label}` : "";
    process.stdout.write(`\r${chalk.cyan(bar)} ${percent}${labelText}`);
    if (final) {
      process.stdout.write("\n");
    }
  }
}

export class Output {
  private mode: OutputMode = "normal";
  private spinner: Ora | null = null;
  private spinnerFactory: OraFactory = ora;
  private interactiveOverride: boolean | null = null;

  setMode(mode: OutputMode): void {
    this.mode = mode;
  }

  reset(): void {
    this.mode = "normal";
    this.stopSpinner();
    this.interactiveOverride = null;
  }

  setSpinnerFactory(factory: OraFactory): void {
    this.spinnerFactory = factory;
  }

  setInteractiveOverride(value: boolean | null): void {
    this.interactiveOverride = value;
  }

  getMode(): OutputMode {
    return this.mode;
  }

  isJson(): boolean {
    return this.mode === "json";
  }

  isQuiet(): boolean {
    return this.mode === "quiet";
  }

  success(message: string): void {
    if (this.mode !== "normal") return;
    console.log(`${chalk.green("✔")} ${message}`);
  }

  warn(message: string): void {
    if (this.mode !== "normal") return;
    console.warn(`${chalk.yellow("⚠ Warning:")} ${message}`);
  }

  info(message: string): void {
    if (this.mode !== "normal") return;
    console.log(`${chalk.blue("ℹ")} ${message}`);
  }

  error(message: string): void {
    if (this.mode === "json") {
      this.jsonError(message);
      return;
    }

    console.error(`${chalk.red("✖ Error:")} ${message}`);
  }

  json<T>(payload: CLIResponse<T>): void {
    console.log(JSON.stringify(payload, null, 2));
  }

  jsonError(message: string, meta?: CLIResponse<null>["meta"]): void {
    const payload: CLIResponse<null> = {
      success: false,
      error: message,
      data: null,
      meta,
    };
    console.error(JSON.stringify(payload, null, 2));
  }

  table<T extends Record<string, unknown>>(items: T[], options: TableOptions<T> = {}): void {
    if (this.mode === "json") {
      const payload: CLIResponse<T[]> = {
        success: true,
        error: null,
        data: items,
        meta: {
          count: items.length,
          total: options.meta?.total ?? items.length,
        },
      };
      this.json(payload);
      return;
    }

    if (this.mode === "quiet") return;

    if (items.length === 0) {
      this.info(options.emptyMessage ?? "No results found.");
      return;
    }

    const columns = options.columns ?? this.columnsFromItem(items[0]);

    const header = columns.map((col) => ({
      value: col.header ?? String(col.key),
      width: col.width ?? "auto",
      truncate: col.truncate,
      align: col.align ?? "left",
      headerAlign: col.align ?? "left",
    }));

    const rows = items.map((item) =>
      columns.map((col) => {
        const rawValue = item[col.key];
        const value = col.formatter ? col.formatter(rawValue, item) : rawValue;
        return value === undefined || value === null ? "" : String(value);
      }),
    );

    const table = ttyTable(header, rows, {
      borderStyle: "solid",
      borderColor: "gray",
      width: "100%",
      defaultValue: "",
    });

    console.log(table.render());

    const total = options.meta?.total ?? items.length;
    if (total !== items.length) {
      console.log(chalk.gray(`Showing ${items.length} of ${total} items`));
    }
  }

  object(obj: Record<string, unknown>): void {
    if (this.mode === "json") {
      const payload: CLIResponse<typeof obj> = {
        success: true,
        error: null,
        data: obj,
        meta: { count: 1 },
      };
      this.json(payload);
      return;
    }

    if (this.mode === "quiet") return;

    for (const [key, value] of Object.entries(obj)) {
      console.log(`${chalk.bold(key)}: ${value ?? ""}`);
    }
  }

  log(message = ""): void {
    if (this.mode === "quiet") return;
    if (this.mode === "json") return;
    console.log(message);
  }

  divider(): void {
    if (this.mode !== "normal") return;
    console.log(chalk.gray(DIVIDER));
  }

  newline(): void {
    if (this.mode !== "normal") return;
    console.log();
  }

  startSpinner(message: string): void {
    if (this.mode !== "normal") return;
    if (!this.isInteractive()) return;
    if (this.spinner) {
      this.spinner.stop();
    }
    this.spinner = this.spinnerFactory({ text: message }).start();
  }

  updateSpinner(message: string): void {
    if (!this.spinner) return;
    this.spinner.text = message;
  }

  stopSpinner(message?: string): void {
    if (!this.spinner) return;
    if (message) {
      this.spinner.succeed(message);
    } else {
      this.spinner.stop();
    }
    this.spinner = null;
  }

  failSpinner(message?: string): void {
    if (!this.spinner) return;
    if (message) {
      this.spinner.fail(message);
    } else {
      this.spinner.stop();
    }
    this.spinner = null;
  }

  createProgressBar(total: number, options: ProgressBarOptions = {}): ProgressBarHandle {
    if (this.mode !== "normal") return noopProgressBar;
    if (!options.force && !this.isInteractive()) return noopProgressBar;
    if (total <= 0) return noopProgressBar;
    return new TextProgressBar(total, options);
  }

  private columnsFromItem<T extends Record<string, unknown>>(item: T): TableColumn<T>[] {
    return Object.keys(item).map((key) => ({
      key: key as keyof T,
      header: String(key),
    }));
  }

  private isInteractive(): boolean {
    if (this.interactiveOverride !== null) {
      return this.interactiveOverride;
    }
    return Boolean(process.stdout.isTTY);
  }
}

export const output = new Output();

export type {
  CLIResponse,
  OutputMode,
  ProgressBarHandle,
  ProgressBarOptions,
  TableColumn,
  TableOptions,
};
