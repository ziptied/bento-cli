import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { registerSubscribersCommands } from "../../../commands/subscribers";
import { output } from "../../../core/output";
import { bento } from "../../../core/sdk";
import type { Subscriber, Tag } from "../../../types/sdk";

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerSubscribersCommands(program);
  return program;
}

function makeSubscriber(
  partial?: Partial<Subscriber<Record<string, unknown>>>
): Subscriber<Record<string, unknown>> {
  return {
    id: "sub_123",
    type: "subscriber",
    attributes: {
      email: "user@example.com",
      uuid: "uuid-123",
      cached_tag_ids: [],
      fields: { name: "Test" },
      unsubscribed_at: null,
      ...(partial?.attributes ?? {}),
    },
    ...(partial ?? {}),
  } as Subscriber<Record<string, unknown>>;
}

function makeTag(id: string, name: string): Tag {
  return {
    id,
    type: "tag",
    attributes: { name, created_at: "2024-01-01T00:00:00Z" },
  } as Tag;
}

describe("subscribers search command", () => {
  afterEach(() => {
    output.reset();
  });

  it("searches by email and renders a table", async () => {
    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscriber: makeSubscriber(),
    });
    const tagsSpy = spyOn(bento, "getTags").mockResolvedValue([]);
    const tableSpy = spyOn(output, "table").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "search",
      "--email",
      "user@example.com",
    ]);

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy.mock.calls[0][0]).toEqual({
      email: "user@example.com",
      uuid: undefined,
    });
    expect(tableSpy).toHaveBeenCalledTimes(1);

    searchSpy.mockRestore();
    tagsSpy.mockRestore();
    tableSpy.mockRestore();
  });

  it("emits JSON when subscriber has matching tag", async () => {
    const sub = makeSubscriber({
      attributes: {
        email: "user@example.com",
        uuid: "uuid-123",
        cached_tag_ids: ["tag_1"],
        fields: { name: "Test" },
        unsubscribed_at: null,
      },
    } as Partial<Subscriber<Record<string, unknown>>>);

    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscriber: sub,
    });
    const tagsSpy = spyOn(bento, "getTags").mockResolvedValue([
      makeTag("tag_1", "vip"),
    ]);
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    output.setMode("json");

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "search",
      "--email",
      "user@example.com",
      "--tag",
      "vip",
    ]);

    expect(searchSpy).toHaveBeenCalledWith({
      email: "user@example.com",
      uuid: undefined,
    });
    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const jsonPayload = jsonSpy.mock.calls[0][0] as { data: unknown[]; meta: { count: number } };
    expect(jsonPayload.data).toHaveLength(1);
    expect(jsonPayload.meta.count).toBe(1);

    searchSpy.mockRestore();
    tagsSpy.mockRestore();
    jsonSpy.mockRestore();
  });

  it("returns empty when subscriber does not have matching tag", async () => {
    const sub = makeSubscriber({
      attributes: {
        email: "user@example.com",
        uuid: "uuid-123",
        cached_tag_ids: ["tag_2"],
        fields: { name: "Test" },
        unsubscribed_at: null,
      },
    } as Partial<Subscriber<Record<string, unknown>>>);

    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscriber: sub,
    });
    const tagsSpy = spyOn(bento, "getTags").mockResolvedValue([
      makeTag("tag_2", "basic"),
    ]);
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    output.setMode("json");

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "search",
      "--email",
      "user@example.com",
      "--tag",
      "vip",
    ]);

    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const jsonPayload = jsonSpy.mock.calls[0][0] as { data: unknown[]; meta: { count: number } };
    expect(jsonPayload.data).toHaveLength(0);
    expect(jsonPayload.meta.count).toBe(0);

    searchSpy.mockRestore();
    tagsSpy.mockRestore();
    jsonSpy.mockRestore();
  });

  it("filters by field value client-side", async () => {
    const sub = makeSubscriber({
      attributes: {
        email: "user@example.com",
        uuid: "uuid-123",
        cached_tag_ids: [],
        fields: { name: "Test", plan: "pro" },
        unsubscribed_at: null,
      },
    } as Partial<Subscriber<Record<string, unknown>>>);

    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscriber: sub,
    });
    const tagsSpy = spyOn(bento, "getTags").mockResolvedValue([]);
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    output.setMode("json");

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "search",
      "--email",
      "user@example.com",
      "--field",
      "plan=pro",
    ]);

    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const jsonPayload = jsonSpy.mock.calls[0][0] as { data: unknown[]; meta: { count: number } };
    expect(jsonPayload.data).toHaveLength(1);

    searchSpy.mockRestore();
    tagsSpy.mockRestore();
    jsonSpy.mockRestore();
  });

  it("returns empty when field filter does not match", async () => {
    const sub = makeSubscriber({
      attributes: {
        email: "user@example.com",
        uuid: "uuid-123",
        cached_tag_ids: [],
        fields: { name: "Test", plan: "starter" },
        unsubscribed_at: null,
      },
    } as Partial<Subscriber<Record<string, unknown>>>);

    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscriber: sub,
    });
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    output.setMode("json");

    const program = buildProgram();
    await program.parseAsync([
      "node",
      "test",
      "subscribers",
      "search",
      "--email",
      "user@example.com",
      "--field",
      "plan=pro",
    ]);

    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const jsonPayload = jsonSpy.mock.calls[0][0] as { data: unknown[]; meta: { count: number } };
    expect(jsonPayload.data).toHaveLength(0);
    expect(jsonPayload.meta.count).toBe(0);

    searchSpy.mockRestore();
    jsonSpy.mockRestore();
  });
});
