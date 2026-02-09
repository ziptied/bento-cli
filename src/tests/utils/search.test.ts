import { describe, expect, it } from "bun:test";
import { filterBySearch } from "../../utils/search";

const tags = [
  { name: "newsletter" },
  { name: "vip-customer" },
  { name: "trial-user" },
  { name: "active" },
  { name: "newsletter-weekly" },
];

const fields = [
  { key: "company_name", name: "Company Name" },
  { key: "plan_type", name: "Plan Type" },
  { key: "signup_source", name: "Signup Source" },
  { key: "company_size", name: "Company Size" },
];

describe("filterBySearch", () => {
  it("returns all items when search term is undefined", () => {
    const result = filterBySearch(tags, undefined, (t) => t.name);
    expect(result).toEqual(tags);
  });

  it("returns all items when search term is empty string", () => {
    const result = filterBySearch(tags, "", (t) => t.name);
    expect(result).toEqual(tags);
  });

  it("returns all items when search term is whitespace", () => {
    const result = filterBySearch(tags, "   ", (t) => t.name);
    expect(result).toEqual(tags);
  });

  it("finds exact match (case-insensitive)", () => {
    const result = filterBySearch(tags, "newsletter", (t) => t.name);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe("newsletter");
  });

  it("is case-insensitive", () => {
    const result = filterBySearch(tags, "NEWSLETTER", (t) => t.name);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe("newsletter");
  });

  it("finds starts-with matches", () => {
    const result = filterBySearch(tags, "news", (t) => t.name);
    expect(result.length).toBe(2);
    expect(result.map((t) => t.name)).toContain("newsletter");
    expect(result.map((t) => t.name)).toContain("newsletter-weekly");
  });

  it("finds contains matches", () => {
    const result = filterBySearch(tags, "customer", (t) => t.name);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("vip-customer");
  });

  it("returns empty array when nothing matches", () => {
    const result = filterBySearch(tags, "nonexistent", (t) => t.name);
    expect(result).toEqual([]);
  });

  it("sorts by score - exact before starts-with before contains", () => {
    const result = filterBySearch(tags, "newsletter", (t) => t.name);
    // Exact match "newsletter" should come before "newsletter-weekly" (starts-with)
    expect(result[0].name).toBe("newsletter");
    expect(result[1].name).toBe("newsletter-weekly");
  });

  it("supports multi-field search", () => {
    const result = filterBySearch(fields, "company", (f) => [f.key, f.name]);
    expect(result.length).toBe(2);
    const keys = result.map((f) => f.key);
    expect(keys).toContain("company_name");
    expect(keys).toContain("company_size");
  });

  it("matches on any field in multi-field search", () => {
    const result = filterBySearch(fields, "Plan Type", (f) => [f.key, f.name]);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].key).toBe("plan_type");
  });

  it("uses best score across multiple fields", () => {
    const items = [{ key: "source", name: "Signup Source" }];
    // "source" is exact match on key (1.0) vs contains in name (0.6)
    // Should use the best score (1.0)
    const result = filterBySearch(items, "source", (f) => [f.key, f.name]);
    expect(result.length).toBe(1);
  });

  it("handles empty items array", () => {
    const result = filterBySearch([], "test", (t: { name: string }) => t.name);
    expect(result).toEqual([]);
  });

  it("handles null/undefined fields in multi-field search gracefully", () => {
    const items = [
      { key: "test", name: undefined as unknown as string },
    ];
    const result = filterBySearch(items, "test", (f) => [f.key, f.name ?? ""]);
    expect(result.length).toBe(1);
  });
});
