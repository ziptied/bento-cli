import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeEmail, parseEmailList, parseSubscriberCSV } from "../../utils/csv";

let tempDir: string;

async function createTempFile(name: string, content: string): Promise<string> {
  const filePath = join(tempDir, name);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

describe("utils/csv", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bento-csv-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("parses subscriber CSV with tags and fields", async () => {
    const file = await createTempFile(
      "subscribers.csv",
      ["email,name,tags,plan,joined", "Test@Example.com,Test User,trial;beta,gold,2024-01-01"].join(
        "\n"
      )
    );

    const result = await parseSubscriberCSV(file);
    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({
      email: "test@example.com",
      name: "Test User",
      tags: ["trial", "beta"],
      fields: {
        plan: "gold",
        joined: "2024-01-01",
      },
    });
  });

  it("reports errors for invalid or missing emails", async () => {
    const file = await createTempFile(
      "invalid.csv",
      ["email,name", ",Missing", "not-an-email,User"].join("\n")
    );

    const result = await parseSubscriberCSV(file);
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain("Missing email");
    expect(result.errors[1].message).toContain("Invalid email format");
  });

  it("parses newline email lists when CSV headers absent", async () => {
    const file = await createTempFile(
      "emails.txt",
      "person1@example.com\nperson2@example.com\nperson1@example.com\n"
    );

    const result = await parseEmailList(file);
    expect(result.errors).toHaveLength(0);
    expect(result.emails).toEqual(["person1@example.com", "person2@example.com"]);
  });

  it("normalizes email casing", () => {
    expect(normalizeEmail("Example@EMAIL.com ")).toBe("example@email.com");
  });
});
