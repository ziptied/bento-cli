import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import ora from "ora";

import { output } from "../../core/output";
import type { CLIResponse } from "../../types/output";

describe("core/output", () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalWrite = process.stdout.write;

  let logs: string[];
  let warns: string[];
  let errors: string[];

  beforeEach(() => {
    logs = [];
    warns = [];
    errors = [];

    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    console.warn = (...args: unknown[]) => {
      warns.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };

    output.reset();
    output.setSpinnerFactory(ora);
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    process.stdout.write = originalWrite;
    output.reset();
    output.setSpinnerFactory(ora);
  });

  it("prints success messages in normal mode", () => {
    output.success("Tagged 5 subscribers");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("Tagged 5 subscribers");
    expect(logs[0]).toContain("✔");
  });

  it("prints warnings in normal mode", () => {
    output.warn("Use --dry-run to preview changes.");
    expect(warns.length).toBe(1);
    expect(warns[0]).toContain("Warning");
  });

  it("suppresses success messages when quiet", () => {
    output.setMode("quiet");
    output.success("Skipped");
    expect(logs.length).toBe(0);
  });

  it("emits JSON errors when in json mode", () => {
    output.setMode("json");
    output.error("Import failed");

    expect(errors.length).toBe(1);
    const payload = JSON.parse(errors[0]) as CLIResponse<null>;
    expect(payload.success).toBeFalse();
    expect(payload.error).toBe("Import failed");
  });

  it("renders data tables as JSON when json mode is enabled", () => {
    output.setMode("json");
    output.table([{ email: "user@example.com", status: "active" }], { meta: { total: 10 } });

    expect(logs.length).toBe(1);
    const payload = JSON.parse(logs[0]) as CLIResponse<Record<string, string>[]>;
    expect(payload.data).toHaveLength(1);
    expect(payload.meta?.total).toBe(10);
  });

  it("shows a helpful message when a table is empty", () => {
    output.table([], { emptyMessage: "No subscribers matched your filters." });
    expect(logs[0]).toContain("No subscribers matched your filters.");
  });

  it("writes progress bar output in interactive mode", () => {
    output.setInteractiveOverride(true);
    const writes: string[] = [];

    process.stdout.write = ((chunk: string | Uint8Array) => {
      const value = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      writes.push(value);
      return true;
    }) as typeof process.stdout.write;

    const bar = output.createProgressBar(10);
    bar.update(5);
    bar.stop("Halfway");

    expect(writes.some((chunk) => chunk.includes("[#####"))).toBeTrue();
    expect(logs.some((line) => line.includes("Halfway"))).toBeTrue();
  });

  it("returns a noop progress bar outside normal mode", () => {
    output.setMode("quiet");
    const writes: string[] = [];
    process.stdout.write = ((chunk: string | Uint8Array) => {
      const value = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      writes.push(value);
      return true;
    }) as typeof process.stdout.write;

    const bar = output.createProgressBar(10, { force: true });
    bar.update(3);
    bar.stop();

    expect(writes.length).toBe(0);
  });

  it("starts spinners only in interactive normal mode", () => {
    let started = 0;
    const fakeSpinner = {
      text: "",
      start() {
        started += 1;
        return this;
      },
      stop: () => {},
      succeed: () => {},
      fail: () => {},
    };

    output.setInteractiveOverride(true);
    output.setSpinnerFactory((() => fakeSpinner) as unknown as typeof ora);

    output.startSpinner("Loading");
    expect(started).toBe(1);
    output.stopSpinner("Done");

    output.setMode("json");
    output.startSpinner("Ignored");
    expect(started).toBe(1);
  });

  it("produces jsonError payloads on stderr", () => {
    output.jsonError("Bad input", { code: 6, count: 0 });
    expect(errors.length).toBe(1);
    const payload = JSON.parse(errors[0]) as CLIResponse<null>;
    expect(payload.success).toBeFalse();
    expect(payload.meta?.code).toBe(6);
  });
});
