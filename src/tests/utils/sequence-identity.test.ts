import { describe, expect, it } from "bun:test";
import { getSequenceId, isSequenceId, resolveSequenceId } from "../../utils/sequence-identity";

describe("sequence identity", () => {
  it("accepts non-empty sequence IDs", () => {
    expect(isSequenceId("123")).toBe(true);
    expect(isSequenceId("  sequence_xyz-9  ")).toBe(true);
  });

  it("rejects blank sequence IDs", () => {
    expect(isSequenceId("   ")).toBe(false);
  });

  it("prefers the top-level id from list sequences", () => {
    const sequenceId = getSequenceId({
      id: "123",
      attributes: {
        prefix_id: "sequence_abc123",
        name: "Welcome",
      },
    });

    expect(sequenceId).toBe("123");
  });

  it("uses top-level prefix_id only when id is missing", () => {
    const sequenceId = getSequenceId({
      id: "",
      prefix_id: "sequence_top_level",
      attributes: { name: "Welcome" },
    });

    expect(sequenceId).toBe("sequence_top_level");
  });

  it("falls back to attributes.id", () => {
    const sequenceId = getSequenceId({
      id: "",
      attributes: { id: "456", name: "Welcome" },
    });

    expect(sequenceId).toBe("456");
  });

  it("returns null when no ID is present", () => {
    const sequenceId = getSequenceId({
      id: "",
      attributes: { name: "Welcome" },
    });

    expect(sequenceId).toBeNull();
  });
});

describe("resolveSequenceId", () => {
  it("returns explicit sequenceId without paginating", async () => {
    const requestedLists: number[] = [];
    const result = await resolveSequenceId({
      sequenceId: "  123  ",
      getSequences: async () => {
        requestedLists.push(1);
        return [];
      },
    });

    expect(result).toEqual({ ok: true, sequenceId: "123" });
    expect(requestedLists).toEqual([]);
  });

  it("accepts any non-empty explicit sequenceId value", async () => {
    const result = await resolveSequenceId({
      sequenceId: "seq_123",
      getSequences: async () => [],
    });

    expect(result).toEqual({ ok: true, sequenceId: "seq_123" });
  });

  it("resolves sequence name to list response ID", async () => {
    const result = await resolveSequenceId({
      sequenceName: "welcome flow",
      getSequences: async () => [
        {
          id: "999",
          attributes: {
            name: "  WELCOME FLOW  ",
          },
        },
      ],
    });

    expect(result).toEqual({ ok: true, sequenceId: "999" });
  });

  it("fails when a matched sequence lacks an ID", async () => {
    const result = await resolveSequenceId({
      sequenceName: "welcome flow",
      getSequences: async () => [
        {
          id: "",
          attributes: { name: "welcome flow" },
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      reason: "missing_id",
      sequenceName: "welcome flow",
    });
  });

  it("returns not_found when no sequence matches", async () => {
    const result = await resolveSequenceId({
      sequenceName: "missing",
      getSequences: async () => [{ id: "sequence_1", attributes: { name: "Other Sequence" } }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "not_found",
      sequenceName: "missing",
    });
  });
});
