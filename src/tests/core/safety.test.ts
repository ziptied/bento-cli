import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { Safety } from "../../core/safety";
import { output } from "../../core/output";

const originalAutoConfirm = process.env.BENTO_AUTO_CONFIRM;

describe("core/safety", () => {
  beforeEach(() => {
    output.reset();
    output.setInteractiveOverride(false);
    delete process.env.BENTO_AUTO_CONFIRM;
  });

  afterEach(() => {
    output.reset();
    output.setInteractiveOverride(null);
    if (originalAutoConfirm === undefined) {
      delete process.env.BENTO_AUTO_CONFIRM;
    } else {
      process.env.BENTO_AUTO_CONFIRM = originalAutoConfirm;
    }
  });

  const buildSafety = (options: { confirmResult?: boolean; interactive?: boolean; threshold?: number } = {}) => {
    const confirmCalls: string[] = [];
    const confirmResult = options.confirmResult ?? true;
    const confirmStub = async ({ message }: { message: string }): Promise<boolean> => {
      confirmCalls.push(message);
      return confirmResult;
    };

    const safety = new Safety({ confirmThreshold: options.threshold ?? 5 }, confirmStub, () => options.interactive ?? true);
    return { safety, confirmCalls };
  };

  const buildOperation = (count: number) => {
    const items = Array.from({ length: count }, (_, index) => ({ email: `user${index}@example.com` }));
    let executions = 0;
    let received: typeof items = [];
    const previewSizes: number[] = [];

    return {
      operation: {
        name: "Tag Subscribers",
        items,
        formatItem: (item: (typeof items)[number]) => ({ email: item.email }),
        preview: (sample: (typeof items)[]) => {
          previewSizes.push(sample.length);
        },
        execute: async (subset: (typeof items)[]) => {
          executions += 1;
          received = subset;
          return subset.length;
        },
      },
      getExecutions: () => executions,
      getReceived: () => received,
      getPreviewSizes: () => previewSizes,
    };
  };

  it("executes operations without prompting when below threshold", async () => {
    const { safety, confirmCalls } = buildSafety({ threshold: 10, interactive: true });
    const { operation, getExecutions, getReceived } = buildOperation(3);

    const result = await safety.protect(operation, { dryRun: false, confirm: false, limit: undefined, sample: undefined });

    expect(result).toBe(3);
    expect(getExecutions()).toBe(1);
    expect(getReceived()).toHaveLength(3);
    expect(confirmCalls).toHaveLength(0);
  });

  it("applies limit before executing", async () => {
    const { safety } = buildSafety({ interactive: true });
    const { operation, getReceived } = buildOperation(6);

    const result = await safety.protect(operation, { dryRun: false, confirm: false, limit: 2, sample: undefined });

    expect(result).toBe(2);
    expect(getReceived()).toHaveLength(2);
    expect(getReceived()[0].email).toBe("user0@example.com");
  });

  it("honors dry-run by skipping execution", async () => {
    const { safety } = buildSafety({ interactive: true });
    const { operation, getExecutions } = buildOperation(4);

    const result = await safety.protect(operation, { dryRun: true, confirm: false, limit: undefined, sample: undefined });

    expect(result).toBeNull();
    expect(getExecutions()).toBe(0);
  });

  it("uses the provided sample size when previewing", async () => {
    const { safety } = buildSafety({ interactive: true });
    const { operation, getPreviewSizes } = buildOperation(10);

    await safety.protect(operation, { dryRun: true, confirm: false, limit: undefined, sample: 2 });

    expect(getPreviewSizes()).toContain(2);
  });

  it("prompts for confirmation when over the threshold", async () => {
    const { safety, confirmCalls } = buildSafety({ threshold: 3, interactive: true, confirmResult: true });
    const { operation, getExecutions } = buildOperation(5);

    await safety.protect(operation, { dryRun: false, confirm: false, limit: undefined, sample: undefined });

    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0]).toContain("Tag Subscribers");
    expect(getExecutions()).toBe(1);
  });

  it("cancels the operation when confirmation is declined", async () => {
    const { safety } = buildSafety({ threshold: 1, interactive: true, confirmResult: false });
    const { operation, getExecutions } = buildOperation(2);

    const result = await safety.protect(operation, { dryRun: false, confirm: false, limit: undefined, sample: undefined });

    expect(result).toBeNull();
    expect(getExecutions()).toBe(0);
  });

  it("requires --confirm when non-interactive", async () => {
    const { safety, confirmCalls } = buildSafety({ interactive: false });
    const { operation, getExecutions } = buildOperation(2);

    const result = await safety.protect(operation, { dryRun: false, confirm: false, limit: undefined, sample: undefined });

    expect(result).toBeNull();
    expect(getExecutions()).toBe(0);
    expect(confirmCalls).toHaveLength(0);
  });

  it("confirmAction skips prompts when --confirm is provided", async () => {
    const { safety, confirmCalls } = buildSafety({ interactive: true });

    await expect(safety.confirmAction("Delete tag?", { confirm: true })).resolves.toBeTrue();
    await expect(safety.confirmAction("Delete tag?", { confirm: false })).resolves.toBeTrue();
    expect(confirmCalls).toHaveLength(1);
  });

  it("parseOptions normalizes numeric inputs", () => {
    const options = Safety.parseOptions({ dryRun: "yes", limit: "10", sample: "-5", confirm: 0 });

    expect(options.dryRun).toBeTrue();
    expect(options.limit).toBe(10);
    expect(options.sample).toBeUndefined();
    expect(options.confirm).toBeFalse();
  });
});
