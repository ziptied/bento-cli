import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { registerDashboardCommand } from "../../commands/dashboard";
import { output } from "../../core/output";
import { config } from "../../core/config";
import type { BentoProfile } from "../../types/config";
import * as browser from "../../utils/browser";

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerDashboardCommand(program);
  return program;
}

function makeProfile(overrides: Partial<BentoProfile> = {}): BentoProfile {
  return {
    publishableKey: "pk",
    secretKey: "sk",
    siteUuid: "site-123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("dashboard command", () => {
  afterEach(() => {
    output.reset();
  });

  it("opens dashboard for the active profile", async () => {
    const openSpy = spyOn(browser, "openInBrowser").mockResolvedValue();
    const profileSpy = spyOn(config, "getCurrentProfile").mockResolvedValue(makeProfile());
    const profileNameSpy = spyOn(config, "getCurrentProfileName").mockResolvedValue("prod");
    const successSpy = spyOn(output, "success").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "dashboard"]);

    expect(openSpy).toHaveBeenCalledWith("https://app.bentonow.com/?site_uuid=site-123");
    expect(successSpy).toHaveBeenCalledWith(
      'Opening Bento dashboard for "prod" in your browser...'
    );

    openSpy.mockRestore();
    profileSpy.mockRestore();
    profileNameSpy.mockRestore();
    successSpy.mockRestore();
  });

  it("opens login page when no profile is configured", async () => {
    const openSpy = spyOn(browser, "openInBrowser").mockResolvedValue();
    const profileSpy = spyOn(config, "getCurrentProfile").mockResolvedValue(null);
    const profileNameSpy = spyOn(config, "getCurrentProfileName").mockResolvedValue(null);
    const infoSpy = spyOn(output, "info").mockImplementation(() => {});

    const program = buildProgram();
    await program.parseAsync(["node", "test", "dashboard"]);

    expect(openSpy).toHaveBeenCalledWith("https://app.bentonow.com/");
    expect(infoSpy).toHaveBeenCalledWith(
      "No active profile is selected. Run 'bento auth login' to connect a site."
    );

    openSpy.mockRestore();
    profileSpy.mockRestore();
    profileNameSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("emits JSON output", async () => {
    const openSpy = spyOn(browser, "openInBrowser").mockResolvedValue();
    const profileSpy = spyOn(config, "getCurrentProfile").mockResolvedValue(makeProfile());
    const profileNameSpy = spyOn(config, "getCurrentProfileName").mockResolvedValue("default");
    const jsonSpy = spyOn(output, "json").mockImplementation(() => {});

    output.setMode("json");

    const program = buildProgram();
    await program.parseAsync(["node", "test", "dashboard"]);

    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const payload = jsonSpy.mock.calls[0][0] as { data: { url: string; profile: string | null } };
    expect(payload.data.url).toBe("https://app.bentonow.com/?site_uuid=site-123");
    expect(payload.data.profile).toBe("default");

    openSpy.mockRestore();
    profileSpy.mockRestore();
    profileNameSpy.mockRestore();
    jsonSpy.mockRestore();
  });

  it("errors when the requested profile does not exist", async () => {
    const openSpy = spyOn(browser, "openInBrowser").mockResolvedValue();
    const getProfileSpy = spyOn(config, "getProfile").mockResolvedValue(null);
    const errorSpy = spyOn(output, "error").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    const program = buildProgram();
    await expect(
      program.parseAsync(["node", "test", "dashboard", "--profile", "missing"])
    ).rejects.toThrow("exit:1");

    expect(openSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Profile "missing" not found. Use \'bento profile list\' to view configured profiles.'
    );

    openSpy.mockRestore();
    getProfileSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
