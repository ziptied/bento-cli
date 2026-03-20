import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "bun";
import { existsSync, mkdirSync, readlinkSync, rmSync, writeFileSync, lstatSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, dirname } from "node:path";

function runCLI(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(["bun", "run", "src/cli.ts", ...args], {
    env: { ...process.env, ...env },
  });

  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

describe("bento skills", () => {
  it("shows skills help", () => {
    const result = runCLI(["skills", "--help"]);
    expect(result.stdout).toContain("Manage AI agent skills");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("install");
  });
});

describe("bento skills list", () => {
  it("lists available skills", () => {
    const result = runCLI(["skills", "list"]);
    expect(result.stdout).toContain("bento-cli");
    expect(result.exitCode).toBe(0);
  });

  it("lists skills in JSON mode", () => {
    const result = runCLI(["skills", "list", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBeGreaterThanOrEqual(1);
    expect(parsed.data[0].name).toBe("bento-cli");
    expect(result.exitCode).toBe(0);
  });
});

describe("bento skills install", () => {
  let tempDir: string;
  let canonicalDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-skills-test-"));
    canonicalDir = join(tempDir, ".agents", "skills");
    agentDir = join(tempDir, ".claude", "skills");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows install help", () => {
    const result = runCLI(["skills", "install", "--help"]);
    expect(result.stdout).toContain("Install skills to AI agent harnesses");
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--skill");
    expect(result.stdout).toContain("--force");
  });

  it("rejects unknown --agent", () => {
    const result = runCLI(["skills", "install", "--agent", "nonexistent"]);
    expect(result.stderr).toContain('Unknown agent "nonexistent"');
    expect(result.exitCode).toBe(1);
  });

  it("rejects unknown --skill", () => {
    const result = runCLI(["skills", "install", "--skill", "nonexistent"]);
    expect(result.stderr).toContain('Unknown skill "nonexistent"');
    expect(result.exitCode).toBe(1);
  });

  it("warns when no agents detected", () => {
    // Use a HOME that has no agent config dirs
    const result = runCLI(["skills", "install"], {
      HOME: tempDir,
      CLAUDE_CONFIG_DIR: join(tempDir, "no-such-dir"),
    });
    expect(result.stderr).toContain("No supported AI agents detected");
  });

  it("installs skill to a detected agent via symlink", () => {
    // Create fake agent config dir so detection works
    mkdirSync(join(tempDir, ".claude"), { recursive: true });

    const result = runCLI(["skills", "install", "--agent", "claude-code", "--force"], {
      HOME: tempDir,
      CLAUDE_CONFIG_DIR: join(tempDir, ".claude"),
    });

    expect(result.exitCode).toBe(0);

    // Check the canonical copy exists
    const canonicalSkill = join(tempDir, ".agents", "skills", "bento-cli", "SKILL.md");
    expect(existsSync(canonicalSkill)).toBe(true);

    // Check the agent symlink exists
    const agentSkill = join(tempDir, ".claude", "skills", "bento-cli");
    expect(existsSync(agentSkill)).toBe(true);

    // Verify it's a symlink pointing to canonical
    const stat = lstatSync(agentSkill);
    if (stat.isSymbolicLink()) {
      const linkTarget = resolve(dirname(agentSkill), readlinkSync(agentSkill));
      expect(linkTarget).toBe(resolve(tempDir, ".agents", "skills", "bento-cli"));
    }
  });

  it("outputs JSON on install with --json", () => {
    mkdirSync(join(tempDir, ".claude"), { recursive: true });

    const result = runCLI(
      ["skills", "install", "--agent", "claude-code", "--force", "--json"],
      {
        HOME: tempDir,
        CLAUDE_CONFIG_DIR: join(tempDir, ".claude"),
      }
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.length).toBeGreaterThanOrEqual(1);
    expect(parsed.data[0].agent).toBe("Claude Code");
    expect(parsed.data[0].skill).toBe("bento-cli");
    expect(["symlink", "copy"]).toContain(parsed.data[0].method);
  });
});
