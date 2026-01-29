import { describe, expect, it } from "bun:test";
import { spawnSync } from "bun";

describe("bento CLI", () => {
  it("shows help with --help flag", () => {
    const result = spawnSync(["bun", "run", "src/cli.ts", "--help"]);
    const stdout = result.stdout.toString();
    expect(stdout).toContain("Usage: bento");
    expect(stdout).toContain("Bento CLI");
  });

  it("shows version with --version flag", () => {
    const result = spawnSync(["bun", "run", "src/cli.ts", "--version"]);
    const stdout = result.stdout.toString();
    expect(stdout).toContain("0.1.0");
  });

  it("prints help when no command is provided", () => {
    const result = spawnSync(["bun", "run", "src/cli.ts"]);
    const stdout = result.stdout.toString();
    expect(stdout).toContain("Usage: bento");
    expect(result.exitCode).toBe(0);
  });

  it("rejects combining --json and --quiet", () => {
    const result = spawnSync(["bun", "run", "src/cli.ts", "--json", "--quiet"]);
    const stderr = result.stderr.toString();
    expect(result.exitCode).toBe(2);
    expect(stderr).toContain("Cannot use --json and --quiet together.");
  });

  it("errors with JSON payload when --json is passed without a command", () => {
    const result = spawnSync(["bun", "run", "src/cli.ts", "--json"]);
    const stderr = result.stderr.toString().trim();
    expect(result.exitCode).toBe(2);
    const payload = JSON.parse(stderr);
    expect(payload.success).toBeFalse();
    expect(payload.error).toContain("No command provided");
  });

  it("prints nothing when --quiet is used without a command", () => {
    const result = spawnSync(["bun", "run", "src/cli.ts", "--quiet"]);
    const stdout = result.stdout.toString();
    expect(result.exitCode).toBe(0);
    expect(stdout).toBe("");
  });
});
