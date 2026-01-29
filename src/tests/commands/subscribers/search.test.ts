import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { registerSubscribersCommands } from "../../../commands/subscribers";
import { output } from "../../../core/output";
import { bento } from "../../../core/sdk";
import type { Subscriber } from "../../../types/sdk";

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

describe("subscribers search command", () => {
  afterEach(() => {
    output.reset();
  });

  it("searches by email and renders a table", async () => {
    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscribers: [makeSubscriber()],
      meta: { page: 1, perPage: 25, count: 1, total: 1, hasMore: false },
    });
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
      tag: undefined,
      fields: undefined,
      page: 1,
      perPage: 25,
    });
    expect(tableSpy).toHaveBeenCalledTimes(1);

    searchSpy.mockRestore();
    tableSpy.mockRestore();
  });

  it("emits JSON payloads when output mode is json", async () => {
    const searchSpy = spyOn(bento, "searchSubscribers").mockResolvedValue({
      subscribers: [makeSubscriber()],
      meta: { page: 2, perPage: 10, count: 1, total: 3, hasMore: true },
    });
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    output.setMode("json");

    const program = buildProgram();
    await program.parseAsync(["node", "test", "subscribers", "search", "--tag", "vip"]);

    expect(searchSpy).toHaveBeenCalledWith({
      email: undefined,
      uuid: undefined,
      tag: "vip",
      fields: undefined,
      page: 1,
      perPage: 25,
    });
    expect(jsonSpy).toHaveBeenCalledTimes(1);

    searchSpy.mockRestore();
    jsonSpy.mockRestore();
  });
});
