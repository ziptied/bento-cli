/**
 * Skills commands
 *
 * Commands:
 * - bento skills list    - List available skills
 * - bento skills install - Install skills to AI agent harnesses
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, relative, resolve } from "node:path";
import type { Command } from "commander";
import { output } from "../core/output";

interface AgentConfig {
  name: string;
  label: string;
  globalSkillsDir: string;
  detect: () => boolean;
}

type InstallMethod = "canonical" | "symlink" | "copy" | "failed";

interface InstallResult {
  agent: string;
  skill: string;
  method: InstallMethod;
  error?: string;
}

const CANONICAL_DIR = resolve(homedir(), ".agents", "skills");

const AGENTS: AgentConfig[] = [
  {
    name: "claude-code",
    label: "Claude Code",
    globalSkillsDir: resolve(
      process.env.CLAUDE_CONFIG_DIR || resolve(homedir(), ".claude"),
      "skills"
    ),
    detect: () =>
      existsSync(
        process.env.CLAUDE_CONFIG_DIR || resolve(homedir(), ".claude")
      ),
  },
  {
    name: "cursor",
    label: "Cursor",
    globalSkillsDir: resolve(homedir(), ".cursor", "skills"),
    detect: () => existsSync(resolve(homedir(), ".cursor")),
  },
  {
    name: "windsurf",
    label: "Windsurf",
    globalSkillsDir: resolve(homedir(), ".codeium", "windsurf", "skills"),
    detect: () => existsSync(resolve(homedir(), ".codeium", "windsurf")),
  },
  {
    name: "codex",
    label: "Codex",
    globalSkillsDir: resolve(
      process.env.CODEX_HOME || resolve(homedir(), ".codex"),
      "skills"
    ),
    detect: () =>
      existsSync(
        process.env.CODEX_HOME || resolve(homedir(), ".codex")
      ),
  },
  {
    name: "copilot",
    label: "GitHub Copilot",
    globalSkillsDir: resolve(homedir(), ".copilot", "skills"),
    detect: () => existsSync(resolve(homedir(), ".copilot")),
  },
  {
    name: "gemini",
    label: "Gemini CLI",
    globalSkillsDir: resolve(homedir(), ".gemini", "skills"),
    detect: () => existsSync(resolve(homedir(), ".gemini")),
  },
  {
    name: "roo",
    label: "Roo Code",
    globalSkillsDir: resolve(homedir(), ".roo", "skills"),
    detect: () => existsSync(resolve(homedir(), ".roo")),
  },
];

export function registerSkillsCommands(program: Command): void {
  const skills = program.command("skills").description("Manage AI agent skills");

  skills
    .command("list")
    .description("List available skills bundled with Bento CLI")
    .action(() => {
      try {
        const sourceDir = getSkillsSourceDir();
        const skillNames = discoverSkills(sourceDir);

        if (skillNames.length === 0) {
          if (output.isJson()) {
            output.json({ success: true, error: null, data: [], meta: { count: 0 } });
          } else {
            output.info("No skills found.");
          }
          return;
        }

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: skillNames.map((name) => ({ name, source: resolve(sourceDir, name) })),
            meta: { count: skillNames.length },
          });
          return;
        }

        output.table(
          skillNames.map((name) => ({ name })),
          {
            columns: [{ key: "name", header: "SKILL" }],
            meta: { total: skillNames.length },
          }
        );
      } catch (error) {
        handleError(error);
      }
    });

  skills
    .command("install [skill-name]")
    .description("Install skills to AI agent harnesses")
    .option("--agent <name>", "Install for a specific agent only")
    .option("--skill <name>", "Install a specific skill only")
    .option("--force", "Overwrite existing installations")
    .action((skillName: string | undefined, options: { agent?: string; skill?: string; force?: boolean }) => {
      // Support both positional arg and --skill flag
      if (skillName && !options.skill) {
        options.skill = skillName;
      }
      try {
        const sourceDir = getSkillsSourceDir();
        let skillNames = discoverSkills(sourceDir);

        if (skillNames.length === 0) {
          output.error("No skills found in package.");
          process.exit(1);
        }

        if (options.skill) {
          if (!skillNames.includes(options.skill)) {
            output.error(
              `Unknown skill "${options.skill}". Available: ${skillNames.join(", ")}`
            );
            process.exit(1);
          }
          skillNames = [options.skill];
        }

        // Resolve target agents
        let targetAgents: AgentConfig[];
        if (options.agent) {
          const match = AGENTS.find((a) => a.name === options.agent);
          if (!match) {
            output.error(
              `Unknown agent "${options.agent}". Available: ${AGENTS.map((a) => a.name).join(", ")}`
            );
            process.exit(1);
          }
          targetAgents = [match];
        } else {
          targetAgents = AGENTS.filter((a) => a.detect());
        }

        if (targetAgents.length === 0) {
          if (output.isJson()) {
            output.json({
              success: true,
              error: null,
              data: [],
              meta: { count: 0, canonical_path: CANONICAL_DIR, skills: skillNames },
            });
          } else {
            output.warn("No supported AI agents detected. Use --agent to target one explicitly.");
          }
          return;
        }

        // Step 1: Copy to canonical location
        output.startSpinner("Installing skills...");
        mkdirSync(CANONICAL_DIR, { recursive: true });

        for (const skill of skillNames) {
          const src = resolve(sourceDir, skill);
          const dest = resolve(CANONICAL_DIR, skill);

          if (existsSync(dest)) {
            if (!options.force) {
              // Check if content differs — skip if identical
              continue;
            }
            rmSync(dest, { recursive: true, force: true });
          }

          cpSync(src, dest, { recursive: true });
        }

        // Step 2: Link/copy to each agent
        const results: InstallResult[] = [];

        for (const agent of targetAgents) {
          mkdirSync(agent.globalSkillsDir, { recursive: true });

          for (const skill of skillNames) {
            const canonical = resolve(CANONICAL_DIR, skill);
            const target = resolve(agent.globalSkillsDir, skill);

            // Skip if canonical and target resolve to same path
            if (resolve(canonical) === resolve(target)) {
              results.push({ agent: agent.label, skill, method: "canonical" });
              continue;
            }

            // Check existing
            if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
              if (!options.force && isCorrectSymlink(target, canonical)) {
                results.push({ agent: agent.label, skill, method: "symlink" });
                continue;
              }
              rmSync(target, { recursive: true, force: true });
            }

            // Try symlink, fall back to copy
            const method = createLink(canonical, target);
            results.push({ agent: agent.label, skill, method });
          }
        }

        output.stopSpinner("Skills installed");

        if (output.isJson()) {
          output.json({
            success: true,
            error: null,
            data: results,
            meta: {
              count: results.length,
              skills: skillNames,
              canonical_path: CANONICAL_DIR,
            },
          });
          return;
        }

        output.table(results, {
          columns: [
            { key: "agent", header: "AGENT" },
            { key: "skill", header: "SKILL" },
            { key: "method", header: "METHOD" },
          ],
          meta: { total: results.length },
        });

        output.success(
          `Installed ${skillNames.length} skill(s) to ${targetAgents.length} agent(s)`
        );
      } catch (error) {
        output.failSpinner();
        handleError(error);
      }
    });
}

function getSkillsSourceDir(): string {
  let dir = resolve(__dirname, "..");
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, "skill");
    if (existsSync(candidate)) {
      // Verify it has at least one skill subdirectory with SKILL.md
      const entries = readdirSync(candidate, { withFileTypes: true });
      const hasSkill = entries.some(
        (e) => e.isDirectory() && existsSync(resolve(candidate, e.name, "SKILL.md"))
      );
      if (hasSkill) return candidate;
    }
    dir = resolve(dir, "..");
  }
  throw new Error("Could not locate the skills directory.");
}

function discoverSkills(sourceDir: string): string[] {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  return entries
    .filter(
      (e) => e.isDirectory() && existsSync(resolve(sourceDir, e.name, "SKILL.md"))
    )
    .map((e) => e.name)
    .sort();
}

function isCorrectSymlink(linkPath: string, expectedTarget: string): boolean {
  try {
    const stat = lstatSync(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const actual = resolve(dirname(linkPath), readlinkSync(linkPath));
    return actual === resolve(expectedTarget);
  } catch {
    return false;
  }
}

function createLink(target: string, linkPath: string): InstallMethod {
  try {
    const relativePath = relative(dirname(linkPath), target);
    const symlinkType = platform() === "win32" ? "junction" : undefined;
    symlinkSync(relativePath, linkPath, symlinkType);
    return "symlink";
  } catch {
    try {
      cpSync(target, linkPath, { recursive: true });
      return "copy";
    } catch {
      return "failed";
    }
  }
}

function handleError(error: unknown): never {
  if (error instanceof Error) {
    output.error(error.message);
  } else {
    output.error("An unexpected error occurred.");
  }
  process.exit(1);
}
