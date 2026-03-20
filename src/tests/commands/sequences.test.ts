import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { spawnSync } from "bun";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

describe("bento sequences", () => {
  it("shows sequences help with --help flag", () => {
    const result = runCLI(["sequences", "--help"]);
    expect(result.stdout).toContain("Manage email sequences");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("create-email");
    expect(result.stdout).toContain("update-email");
  });

  it("shows create-email help", () => {
    const result = runCLI(["sequences", "create-email", "--help"]);
    expect(result.stdout).toContain("Create an email template in a sequence");
    expect(result.stdout).toContain("--sequence-id");
    expect(result.stdout).toContain("--subject");
    expect(result.stdout).toContain("--html");
    expect(result.stdout).toContain("--html-file");
    expect(result.stdout).toContain("--delay-interval");
    expect(result.stdout).toContain("--delay-count");
  });

  it("shows update-email help", () => {
    const result = runCLI(["sequences", "update-email", "--help"]);
    expect(result.stdout).toContain("Update an existing sequence email template");
    expect(result.stdout).toContain("--template-id");
    expect(result.stdout).toContain("--subject");
    expect(result.stdout).toContain("--html");
    expect(result.stdout).toContain("--html-file");
  });
});

describe("bento sequences list", () => {
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

    const result = runCLI(["sequences", "list"], { configPath });
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});

describe("sequences create-email validation", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires exactly one of --html or --html-file", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(
      [
        "sequences",
        "create-email",
        "--sequence-id",
        "sequence_1",
        "--subject",
        "Hello",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Provide exactly one of --html or --html-file");
    expect(result.exitCode).toBe(1);
  });

  it("rejects invalid delay interval", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(
      [
        "sequences",
        "create-email",
        "--sequence-id",
        "sequence_1",
        "--subject",
        "Hello",
        "--html",
        "<p>Hello</p>",
        "--delay-interval",
        "weeks",
        "--delay-count",
        "2",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("--delay-interval must be one of");
    expect(result.exitCode).toBe(1);
  });
});

describe("sequences update-email validation", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires --template-id option", () => {
    const result = runCLI(["sequences", "update-email", "--subject", "Hello"]);
    expect(result.stderr).toContain("required option");
    expect(result.stderr).toContain("--template-id");
    expect(result.exitCode).toBe(1);
  });

  it("requires at least one update field", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(
      [
        "sequences",
        "update-email",
        "--template-id",
        "12345",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("At least one of --subject, --html, or --html-file must be provided");
    expect(result.exitCode).toBe(1);
  });

  it("rejects when both --html and --html-file are provided", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const htmlFile = join(tempDir, "email.html");
    await writeFile(htmlFile, "<p>Test</p>");

    const result = runCLI(
      [
        "sequences",
        "update-email",
        "--template-id",
        "12345",
        "--html",
        "<p>Inline</p>",
        "--html-file",
        htmlFile,
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Provide exactly one of --html or --html-file");
    expect(result.exitCode).toBe(1);
  });

  it("requires authentication", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, current: null, profiles: {} })
    );

    const result = runCLI(
      [
        "sequences",
        "update-email",
        "--template-id",
        "12345",
        "--subject",
        "Updated subject",
      ],
      { configPath }
    );
    expect(result.stderr).toContain("Not authenticated");
    expect(result.exitCode).toBe(1);
  });
});
