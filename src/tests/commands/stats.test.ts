import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import { spawnSync } from "bun";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registerStatsCommands } from "../../commands/stats";
import { output } from "../../core/output";
import { bento } from "../../core/sdk";
import type { SiteStats } from "../../types/sdk";

/**
 * Helper to run CLI commands with a custom config path
 */
function runCLI(
  args: string[],
  options: { configPath?: string; input?: string } = {}
) {
  const env: Record<string, string> = {
    ...process.env,
    BENTO_API_KEY: "test-api-key",
    BENTO_SITE_ID: "test-site-id",
  };

  if (options.configPath) {
    env.BENTO_CONFIG_PATH = options.configPath;
  }

  const result = spawnSync(["bun", "run", "src/cli.ts", ...args], {
    env,
    stdin: options.input ? Buffer.from(options.input) : undefined,
  });

  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerStatsCommands(program);
  return program;
}

describe("bento stats", () => {
  it("shows stats help with --help flag", () => {
    const result = runCLI(["stats", "--help"]);
    expect(result.stdout).toContain("View site statistics");
    expect(result.stdout).toContain("site");
  });

  it("shows site help", () => {
    const result = runCLI(["stats", "site", "--help"]);
    expect(result.stdout).toContain("Show site-wide statistics");
  });
});

describe("bento stats site", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires authentication", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["stats", "site"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("outputs JSON error with --json flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["stats", "site", "--json"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });

  it("produces no output with --quiet flag when not authenticated", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(["stats", "site", "--quiet"], { configPath });
    // Errors still print in quiet mode
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("stats site rendering", () => {
  afterEach(() => {
    output.reset();
  });

  it("renders rich metrics from canonical stats response", async () => {
    output.setInteractiveOverride(false);

    const statsSpy = spyOn(bento, "getSiteStats").mockResolvedValue({
      total_subscribers: 10,
      active_subscribers: 8,
      unsubscribed_count: 2,
      broadcast_count: 5,
      average_open_rate: 0.432,
      average_click_rate: 25,
    } as SiteStats);
    const objectSpy = spyOn(output, "object").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "stats", "site"]);

    expect(objectSpy).toHaveBeenCalledTimes(2);
    const subscriberMetrics = objectSpy.mock.calls[0][0] as Record<string, string>;
    expect(subscriberMetrics).toEqual({
      "Total Subscribers": "10",
      "Active Subscribers": "8",
      "Unsubscribed": "2",
    });
    const broadcastMetrics = objectSpy.mock.calls[1][0] as Record<string, string>;
    expect(broadcastMetrics).toEqual({
      "Total Broadcasts": "5",
      "Avg. Open Rate": "43.2%",
      "Avg. Click Rate": "25.0%",
    });

    statsSpy.mockRestore();
    objectSpy.mockRestore();
  });

  it("falls back to legacy stat keys", async () => {
    output.setInteractiveOverride(false);

    const statsSpy = spyOn(bento, "getSiteStats").mockResolvedValue({
      user_count: 47,
      subscriber_count: 43,
      unsubscriber_count: 4,
      total_broadcasts: 12,
      open_rate: 0.5,
      click_rate: 0.25,
    } as unknown as SiteStats);
    const objectSpy = spyOn(output, "object").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "stats", "site"]);

    expect(objectSpy).toHaveBeenCalledTimes(2);
    const subscriberMetrics = objectSpy.mock.calls[0][0] as Record<string, string>;
    expect(subscriberMetrics).toEqual({
      "Total Subscribers": "47",
      "Active Subscribers": "43",
      "Unsubscribed": "4",
    });
    const broadcastMetrics = objectSpy.mock.calls[1][0] as Record<string, string>;
    expect(broadcastMetrics).toEqual({
      "Total Broadcasts": "12",
      "Avg. Open Rate": "50.0%",
      "Avg. Click Rate": "25.0%",
    });

    statsSpy.mockRestore();
    objectSpy.mockRestore();
  });
});
