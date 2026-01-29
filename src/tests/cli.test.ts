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
});
