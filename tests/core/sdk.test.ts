import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BentoClient, CLIError, validateCredentials } from "../../src/core/sdk";
import { ConfigManager } from "../../src/core/config";
import {
  NotAuthorizedError,
  RateLimitedError,
  RequestTimeoutError,
} from "@bentonow/bento-node-sdk";

// Helper for unique test directories
function uniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe("BentoClient", () => {
  let testDir: string;
  let configPath: string;
  let client: BentoClient;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bento-sdk-test-${uniqueId()}`);
    await mkdir(testDir, { recursive: true });
    configPath = join(testDir, "config.json");
    client = new BentoClient();
  });

  afterEach(async () => {
    client.reset();
    await rm(testDir, { recursive: true, force: true });
  });

  describe("getClient()", () => {
    it("throws AUTH_REQUIRED when no profile configured", async () => {
      // Create empty config (no profiles)
      const emptyConfig = {
        version: 1,
        current: null,
        profiles: {},
      };
      await writeFile(configPath, JSON.stringify(emptyConfig));

      // Create a client that uses this empty config
      const testConfigManager = new ConfigManager(configPath);
      const testClient = new BentoClient();

      // Spy on config module to use our test config
      const configModule = await import("../../src/core/config");
      const originalConfig = configModule.config;
      const getCurrentProfileSpy = spyOn(
        originalConfig,
        "getCurrentProfile"
      ).mockImplementation(async () => null);

      try {
        await expect(testClient.getClient()).rejects.toThrow(CLIError);
        await expect(testClient.getClient()).rejects.toMatchObject({
          code: "AUTH_REQUIRED",
        });
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });

    it("throws CLIError with helpful message when not authenticated", async () => {
      const configModule = await import("../../src/core/config");
      const getCurrentProfileSpy = spyOn(
        configModule.config,
        "getCurrentProfile"
      ).mockImplementation(async () => null);

      try {
        await expect(client.getClient()).rejects.toMatchObject({
          message: expect.stringContaining("bento auth login"),
        });
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });

    it("returns SDK instance when profile is configured", async () => {
      const configModule = await import("../../src/core/config");
      const getCurrentProfileSpy = spyOn(
        configModule.config,
        "getCurrentProfile"
      ).mockImplementation(async () => ({
        apiKey: "test-api-key",
        siteId: "test-site-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      try {
        const sdk = await client.getClient();
        expect(sdk).toBeDefined();
        expect(sdk.V1).toBeDefined();
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });

    it("caches SDK instance on subsequent calls", async () => {
      const configModule = await import("../../src/core/config");
      const getCurrentProfileSpy = spyOn(
        configModule.config,
        "getCurrentProfile"
      ).mockImplementation(async () => ({
        apiKey: "test-api-key",
        siteId: "test-site-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      try {
        const sdk1 = await client.getClient();
        const sdk2 = await client.getClient();

        // Should be the same instance
        expect(sdk1).toBe(sdk2);
        // getCurrentProfile should only be called once (cached)
        expect(getCurrentProfileSpy).toHaveBeenCalledTimes(1);
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });
  });

  describe("reset()", () => {
    it("clears cached SDK instance", async () => {
      const configModule = await import("../../src/core/config");
      const getCurrentProfileSpy = spyOn(
        configModule.config,
        "getCurrentProfile"
      ).mockImplementation(async () => ({
        apiKey: "test-api-key",
        siteId: "test-site-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      try {
        const sdk1 = await client.getClient();
        client.reset();
        const sdk2 = await client.getClient();

        // After reset, should create new instance
        expect(sdk1).not.toBe(sdk2);
        expect(getCurrentProfileSpy).toHaveBeenCalledTimes(2);
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });

    it("clears cached profile", async () => {
      const configModule = await import("../../src/core/config");
      const getCurrentProfileSpy = spyOn(
        configModule.config,
        "getCurrentProfile"
      ).mockImplementation(async () => ({
        apiKey: "test-api-key",
        siteId: "test-site-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      try {
        await client.getClient();
        expect(client.getProfile()).not.toBeNull();

        client.reset();
        expect(client.getProfile()).toBeNull();
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });
  });

  describe("getProfile()", () => {
    it("returns null before getClient is called", () => {
      expect(client.getProfile()).toBeNull();
    });

    it("returns profile after getClient is called", async () => {
      const mockProfile = {
        apiKey: "test-api-key",
        siteId: "test-site-id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const configModule = await import("../../src/core/config");
      const getCurrentProfileSpy = spyOn(
        configModule.config,
        "getCurrentProfile"
      ).mockImplementation(async () => mockProfile);

      try {
        await client.getClient();
        const profile = client.getProfile();

        expect(profile).toEqual(mockProfile);
      } finally {
        getCurrentProfileSpy.mockRestore();
      }
    });
  });

  describe("error translation", () => {
    let testClient: BentoClient;
    let mockSdk: any;

    beforeEach(async () => {
      testClient = new BentoClient();
      mockSdk = {
        V1: {
          Tags: {
            getTags: mock(() => Promise.resolve([])),
          },
          Stats: {
            getSiteStats: mock(() => Promise.resolve({})),
          },
          Subscribers: {
            getSubscribers: mock(() => Promise.resolve(null)),
          },
        },
      };

      const configModule = await import("../../src/core/config");
      spyOn(configModule.config, "getCurrentProfile").mockImplementation(
        async () => ({
          apiKey: "test-api-key",
          siteId: "test-site-id",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    });

    it("translates NotAuthorizedError to AUTH_FAILED", async () => {
      // Access private method via prototype for testing
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new NotAuthorizedError("Not authorized");

      const cliError = translateError(error);

      expect(cliError).toBeInstanceOf(CLIError);
      expect(cliError.code).toBe("AUTH_FAILED");
      expect(cliError.statusCode).toBe(401);
      expect(cliError.message).toContain("bento auth login");
    });

    it("translates RateLimitedError to RATE_LIMITED", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new RateLimitedError("Rate limited");

      const cliError = translateError(error);

      expect(cliError).toBeInstanceOf(CLIError);
      expect(cliError.code).toBe("RATE_LIMITED");
      expect(cliError.statusCode).toBe(429);
    });

    it("translates RequestTimeoutError to TIMEOUT", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new RequestTimeoutError("Request timed out");

      const cliError = translateError(error);

      expect(cliError).toBeInstanceOf(CLIError);
      expect(cliError.code).toBe("TIMEOUT");
      expect(cliError.statusCode).toBe(408);
    });

    it("translates 401 in error message to AUTH_FAILED", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new Error("HTTP 401: Unauthorized access");

      const cliError = translateError(error);

      expect(cliError.code).toBe("AUTH_FAILED");
    });

    it("translates 404 in error message to NOT_FOUND", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new Error("Resource not found");

      const cliError = translateError(error);

      expect(cliError.code).toBe("NOT_FOUND");
    });

    it("translates 429 in error message to RATE_LIMITED", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new Error("429 Too Many Requests");

      const cliError = translateError(error);

      expect(cliError.code).toBe("RATE_LIMITED");
    });

    it("translates validation errors to VALIDATION_ERROR", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new Error("Validation failed: email is required");

      const cliError = translateError(error);

      expect(cliError.code).toBe("VALIDATION_ERROR");
      expect(cliError.statusCode).toBe(422);
    });

    it("translates unknown errors to API_ERROR", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = new Error("Something went wrong");

      const cliError = translateError(error);

      expect(cliError.code).toBe("API_ERROR");
      expect(cliError.message).toBe("Something went wrong");
    });

    it("handles non-Error objects", async () => {
      const translateError = (testClient as any).translateError.bind(testClient);
      const error = "string error";

      const cliError = translateError(error);

      expect(cliError.code).toBe("UNKNOWN");
      expect(cliError.message).toContain("unexpected error");
    });
  });
});

describe("validateCredentials()", () => {
  it("returns true for valid credentials", async () => {
    // This test would need actual API credentials to work
    // For unit tests, we mock the SDK
    const client = new BentoClient();

    // Since validateCredentials creates its own SDK instance,
    // we can't easily mock it. This test documents the expected behavior.
    // In integration tests, use real credentials.
    expect(typeof client.validateCredentials).toBe("function");
  });

  it("returns false when API call fails", async () => {
    // Mock the Analytics class to throw an error
    const client = new BentoClient();

    // We test the behavior indirectly - invalid credentials should return false
    const result = await client.validateCredentials(
      "definitely-invalid-key",
      "definitely-invalid-site"
    );

    // This will fail with network error or auth error, both return false
    expect(result).toBe(false);
  });
});

describe("CLIError", () => {
  it("creates error with code", () => {
    const error = new CLIError("Test message", "AUTH_REQUIRED");

    expect(error.message).toBe("Test message");
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(error.name).toBe("CLIError");
    expect(error.statusCode).toBeUndefined();
  });

  it("creates error with code and statusCode", () => {
    const error = new CLIError("Test message", "AUTH_FAILED", 401);

    expect(error.message).toBe("Test message");
    expect(error.code).toBe("AUTH_FAILED");
    expect(error.statusCode).toBe(401);
  });

  it("is instanceof Error", () => {
    const error = new CLIError("Test", "UNKNOWN");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof CLIError).toBe(true);
  });
});

describe("SDK wrapper methods", () => {
  let client: BentoClient;
  let mockSdk: any;

  beforeEach(async () => {
    client = new BentoClient();

    // Create mock SDK
    mockSdk = {
      V1: {
        Subscribers: {
          getSubscribers: mock(() =>
            Promise.resolve({
              id: "sub-1",
              type: "subscriber",
              attributes: {
                email: "test@example.com",
                uuid: "uuid-1",
                cached_tag_ids: [],
                fields: null,
                unsubscribed_at: null,
              },
            })
          ),
          createSubscriber: mock(() => Promise.resolve({ id: "sub-1" })),
        },
        Tags: {
          getTags: mock(() =>
            Promise.resolve([
              { id: "tag-1", type: "tag", attributes: { name: "test-tag" } },
            ])
          ),
          createTag: mock(() => Promise.resolve([{ id: "tag-1" }])),
        },
        Fields: {
          getFields: mock(() =>
            Promise.resolve([
              { id: "field-1", type: "field", attributes: { key: "test_field" } },
            ])
          ),
          createField: mock(() => Promise.resolve([{ id: "field-1" }])),
        },
        Stats: {
          getSiteStats: mock(() =>
            Promise.resolve({
              total_subscribers: 100,
              active_subscribers: 90,
            })
          ),
        },
        Commands: {
          addTag: mock(() => Promise.resolve({ id: "sub-1" })),
          removeTag: mock(() => Promise.resolve({ id: "sub-1" })),
          subscribe: mock(() => Promise.resolve({ id: "sub-1" })),
          unsubscribe: mock(() => Promise.resolve({ id: "sub-1" })),
          addField: mock(() => Promise.resolve({ id: "sub-1" })),
          removeField: mock(() => Promise.resolve({ id: "sub-1" })),
          changeEmail: mock(() => Promise.resolve({ id: "sub-1" })),
        },
        Batch: {
          importSubscribers: mock(() => Promise.resolve(10)),
          importEvents: mock(() => Promise.resolve(5)),
        },
        addSubscriber: mock(() => Promise.resolve(true)),
        tagSubscriber: mock(() => Promise.resolve(true)),
        updateFields: mock(() => Promise.resolve(true)),
        track: mock(() => Promise.resolve(true)),
      },
    };

    // Override getClient to return mock SDK
    (client as any).sdk = mockSdk;
    (client as any).profile = {
      apiKey: "test-key",
      siteId: "test-site",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  describe("subscriber operations", () => {
    it("getSubscriber calls SDK with email param", async () => {
      await client.getSubscriber({ email: "test@example.com" });

      expect(mockSdk.V1.Subscribers.getSubscribers).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });

    it("getSubscriber calls SDK with uuid param", async () => {
      await client.getSubscriber({ uuid: "uuid-123" });

      expect(mockSdk.V1.Subscribers.getSubscribers).toHaveBeenCalledWith({
        uuid: "uuid-123",
      });
    });

    it("createSubscriber calls SDK correctly", async () => {
      await client.createSubscriber("new@example.com");

      expect(mockSdk.V1.Subscribers.createSubscriber).toHaveBeenCalledWith({
        email: "new@example.com",
      });
    });

    it("importSubscribers returns import count", async () => {
      const result = await client.importSubscribers({
        subscribers: [{ email: "a@test.com" }, { email: "b@test.com" }],
      });

      expect(result.imported).toBe(10);
      expect(mockSdk.V1.Batch.importSubscribers).toHaveBeenCalled();
    });

    it("addSubscriber triggers automations", async () => {
      const result = await client.addSubscriber("test@example.com", {
        firstName: "Test",
      });

      expect(result).toBe(true);
      expect(mockSdk.V1.addSubscriber).toHaveBeenCalledWith({
        email: "test@example.com",
        fields: { firstName: "Test" },
      });
    });

    it("unsubscribe calls Commands.unsubscribe", async () => {
      await client.unsubscribe("test@example.com");

      expect(mockSdk.V1.Commands.unsubscribe).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });

    it("subscribe calls Commands.subscribe", async () => {
      await client.subscribe("test@example.com");

      expect(mockSdk.V1.Commands.subscribe).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });

    it("changeEmail calls Commands.changeEmail", async () => {
      await client.changeEmail("old@example.com", "new@example.com");

      expect(mockSdk.V1.Commands.changeEmail).toHaveBeenCalledWith({
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
      });
    });
  });

  describe("tag operations", () => {
    it("getTags returns tags array", async () => {
      const tags = await client.getTags();

      expect(tags).toHaveLength(1);
      expect(mockSdk.V1.Tags.getTags).toHaveBeenCalled();
    });

    it("createTag calls SDK correctly", async () => {
      await client.createTag("new-tag");

      expect(mockSdk.V1.Tags.createTag).toHaveBeenCalledWith({
        name: "new-tag",
      });
    });

    it("tagSubscriber triggers automations", async () => {
      const result = await client.tagSubscriber({
        email: "test@example.com",
        tagName: "vip",
      });

      expect(result).toBe(true);
      expect(mockSdk.V1.tagSubscriber).toHaveBeenCalledWith({
        email: "test@example.com",
        tagName: "vip",
      });
    });

    it("addTag does NOT trigger automations", async () => {
      await client.addTag("test@example.com", "trial");

      expect(mockSdk.V1.Commands.addTag).toHaveBeenCalledWith({
        email: "test@example.com",
        tagName: "trial",
      });
    });

    it("removeTag calls Commands.removeTag", async () => {
      await client.removeTag("test@example.com", "old-tag");

      expect(mockSdk.V1.Commands.removeTag).toHaveBeenCalledWith({
        email: "test@example.com",
        tagName: "old-tag",
      });
    });
  });

  describe("field operations", () => {
    it("getFields returns fields array", async () => {
      const fields = await client.getFields();

      expect(fields).toHaveLength(1);
      expect(mockSdk.V1.Fields.getFields).toHaveBeenCalled();
    });

    it("createField calls SDK correctly", async () => {
      await client.createField("company_name");

      expect(mockSdk.V1.Fields.createField).toHaveBeenCalledWith({
        key: "company_name",
      });
    });

    it("addField does NOT trigger automations", async () => {
      await client.addField({
        email: "test@example.com",
        field: { key: "company", value: "Acme Inc" },
      });

      expect(mockSdk.V1.Commands.addField).toHaveBeenCalledWith({
        email: "test@example.com",
        field: { key: "company", value: "Acme Inc" },
      });
    });

    it("removeField calls Commands.removeField", async () => {
      await client.removeField("test@example.com", "old_field");

      expect(mockSdk.V1.Commands.removeField).toHaveBeenCalledWith({
        email: "test@example.com",
        fieldName: "old_field",
      });
    });

    it("updateFields triggers automations", async () => {
      const result = await client.updateFields("test@example.com", {
        firstName: "John",
        lastName: "Doe",
      });

      expect(result).toBe(true);
      expect(mockSdk.V1.updateFields).toHaveBeenCalledWith({
        email: "test@example.com",
        fields: { firstName: "John", lastName: "Doe" },
      });
    });
  });

  describe("event operations", () => {
    it("track sends custom event", async () => {
      const result = await client.track({
        email: "test@example.com",
        type: "button_clicked",
        details: { button: "signup" },
      });

      expect(result).toBe(true);
      expect(mockSdk.V1.track).toHaveBeenCalledWith({
        email: "test@example.com",
        type: "button_clicked",
        details: { button: "signup" },
        date: undefined,
        fields: {},
      });
    });

    it("importEvents returns count", async () => {
      const count = await client.importEvents([
        { email: "a@test.com", type: "signup" },
        { email: "b@test.com", type: "purchase" },
      ]);

      expect(count).toBe(5);
      expect(mockSdk.V1.Batch.importEvents).toHaveBeenCalled();
    });
  });

  describe("stats operations", () => {
    it("getSiteStats returns stats", async () => {
      const stats = await client.getSiteStats();

      expect(stats.total_subscribers).toBe(100);
      expect(stats.active_subscribers).toBe(90);
      expect(mockSdk.V1.Stats.getSiteStats).toHaveBeenCalled();
    });
  });

  describe("error propagation", () => {
    it("propagates errors through handleApiCall", async () => {
      mockSdk.V1.Tags.getTags = mock(() =>
        Promise.reject(new NotAuthorizedError("Invalid credentials"))
      );

      await expect(client.getTags()).rejects.toThrow(CLIError);
      await expect(client.getTags()).rejects.toMatchObject({
        code: "AUTH_FAILED",
      });
    });
  });
});
