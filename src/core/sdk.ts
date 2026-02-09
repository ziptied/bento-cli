/**
 * Bento Node SDK wrapper
 *
 * All API operations go through this module to:
 * - Centralize auth/profile handling
 * - Provide consistent error transformation
 * - Enable easy mocking in tests
 * - Add logging, rate limiting, retries
 *
 * Commands should NEVER instantiate the SDK directly.
 */

import { Analytics } from "@bentonow/bento-node-sdk";
import {
  NotAuthorizedError,
  RateLimitedError,
  RequestTimeoutError,
} from "@bentonow/bento-node-sdk";
import type { BentoProfile } from "../types/config";
import type {
  AddFieldParams,
  Broadcast,
  CreateBroadcastInput,
  Field,
  GetSubscriberParams,
  ImportResult,
  ImportSubscribersParams,
  SDKErrorCode,
  SiteStats,
  Subscriber,
  SubscriberSearchParams,
  SubscriberSearchResult,
  Tag,
  TagSubscriberParams,
  TrackEventParams,
} from "../types/sdk";
import { config } from "./config";

/**
 * CLI-specific error class with error codes
 *
 * Provides user-friendly error messages with machine-readable codes
 * for consistent error handling across commands.
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: SDKErrorCode,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "CLIError";
  }
}

/**
 * BentoClient wrapper class
 *
 * Lazily initializes the SDK with credentials from the active profile.
 * Provides typed methods for common operations with consistent error handling.
 */
export class BentoClient {
  private sdk: Analytics | null = null;
  private profile: BentoProfile | null = null;
  private readonly apiBaseUrl = process.env.BENTO_API_BASE_URL ?? "https://app.bentonow.com/api/v1";

  /**
   * Get or create SDK instance with current profile credentials
   */
  async getClient(): Promise<Analytics> {
    if (this.sdk) {
      return this.sdk;
    }

    const currentProfile = await config.getCurrentProfile();
    if (!currentProfile) {
      throw new CLIError("Not authenticated. Run 'bento auth login' first.", "AUTH_REQUIRED");
    }

    this.profile = currentProfile;
    this.sdk = new Analytics({
      siteUuid: currentProfile.siteUuid,
      authentication: {
        publishableKey: currentProfile.publishableKey,
        secretKey: currentProfile.secretKey,
      },
      logErrors: process.env.DEBUG?.includes("bento"),
    });

    return this.sdk;
  }

  /**
   * Validate credentials without storing them
   *
   * Makes a lightweight API call (getSiteStats) to verify the credentials are valid.
   */
  async validateCredentials(
    publishableKey: string,
    secretKey: string,
    siteUuid: string
  ): Promise<boolean> {
    try {
      const tempSdk = new Analytics({
        siteUuid,
        authentication: {
          publishableKey,
          secretKey,
        },
      });

      // Make a lightweight API call to validate credentials
      await tempSdk.V1.Stats.getSiteStats();
      return true;
    } catch (error) {
      // Auth failures → credentials are invalid, return false
      if (error instanceof NotAuthorizedError) {
        return false;
      }

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("403") || msg.includes("forbidden")) {
          return false;
        }

        // Server errors, timeouts, network failures → rethrow so caller can inform the user
        if (msg.includes("500") || msg.includes("timeout") || msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("fetch failed")) {
          throw new CLIError(
            "Could not reach the Bento API to validate credentials. The service may be temporarily unavailable — please try again.",
            "API_ERROR"
          );
        }
      }

      if (error instanceof RateLimitedError) {
        throw new CLIError(
          "Rate limited while validating credentials. Please wait a moment and try again.",
          "RATE_LIMITED",
          429
        );
      }

      if (error instanceof RequestTimeoutError) {
        throw new CLIError(
          "Request timed out while validating credentials. Please try again.",
          "TIMEOUT",
          408
        );
      }

      // Unknown errors — assume bad credentials
      return false;
    }
  }

  /**
   * Reset client (used when switching profiles)
   */
  reset(): void {
    this.sdk = null;
    this.profile = null;
  }

  /**
   * Get current profile info (if authenticated)
   */
  getProfile(): BentoProfile | null {
    return this.profile;
  }

  // ============================================================
  // Subscriber Operations
  // ============================================================

  /**
   * Get a subscriber by email or UUID
   */
  async getSubscriber(
    params: GetSubscriberParams
  ): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();

    if (!params.email && !params.uuid) {
      throw new CLIError(
        "Either email or uuid must be provided to search for a subscriber",
        "VALIDATION_ERROR"
      );
    }

    if (params.email) {
      return this.handleApiCall(() => sdk.V1.Subscribers.getSubscribers({ email: params.email }));
    }

    return this.handleApiCall(() =>
      sdk.V1.Subscribers.getSubscribers({ uuid: params.uuid as string })
    );
  }

  async searchSubscribers(params: SubscriberSearchParams): Promise<SubscriberSearchResult> {
    if (!params.email && !params.uuid) {
      throw new CLIError(
        "Provide --email or --uuid to look up a subscriber.",
        "VALIDATION_ERROR"
      );
    }

    const subscriber = await this.getSubscriber({
      email: params.email,
      uuid: params.uuid,
    });

    return { subscriber };
  }

  /**
   * Create a subscriber
   */
  async createSubscriber(email: string): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Subscribers.createSubscriber({ email }));
  }

  /**
   * Import subscribers in bulk (up to 1000)
   *
   * Note: This does NOT trigger automations. Use addSubscriber for automation triggers.
   */
  async importSubscribers<S = Record<string, unknown>>(
    params: ImportSubscribersParams<S>
  ): Promise<ImportResult> {
    const sdk = await this.getClient();
    const count = await this.handleApiCall(() =>
      sdk.V1.Batch.importSubscribers({
        subscribers: params.subscribers as ({ email: string } & Partial<{
          [key: string]: unknown;
        }>)[],
      })
    );
    return { imported: count };
  }

  /**
   * Add a subscriber (TRIGGERS automations)
   */
  async addSubscriber(email: string, fields?: Record<string, unknown>): Promise<boolean> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.addSubscriber({ email, fields }));
  }

  /**
   * Unsubscribe a subscriber (does NOT trigger automations)
   */
  async unsubscribe(email: string): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Commands.unsubscribe({ email }));
  }

  /**
   * Subscribe (resubscribe) a subscriber (does NOT trigger automations)
   */
  async subscribe(email: string): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Commands.subscribe({ email }));
  }

  /**
   * Change a subscriber's email
   */
  async changeEmail(
    oldEmail: string,
    newEmail: string
  ): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Commands.changeEmail({ oldEmail, newEmail }));
  }

  // ============================================================
  // Tag Operations
  // ============================================================

  /**
   * List all tags
   */
  async getTags(): Promise<Tag[] | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Tags.getTags());
  }

  /**
   * Create a tag
   */
  async createTag(name: string): Promise<Tag[] | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Tags.createTag({ name }));
  }

  /**
   * Tag a subscriber (TRIGGERS automations)
   */
  async tagSubscriber(params: TagSubscriberParams): Promise<boolean> {
    const sdk = await this.getClient();
    return this.handleApiCall(() =>
      sdk.V1.tagSubscriber({
        email: params.email,
        tagName: params.tagName,
      })
    );
  }

  /**
   * Add tag to subscriber (does NOT trigger automations)
   */
  async addTag(
    email: string,
    tagName: string
  ): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Commands.addTag({ email, tagName }));
  }

  /**
   * Remove tag from subscriber
   */
  async removeTag(
    email: string,
    tagName: string
  ): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Commands.removeTag({ email, tagName }));
  }

  // ============================================================
  // Field Operations
  // ============================================================

  /**
   * List all fields
   */
  async getFields(): Promise<Field[] | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Fields.getFields());
  }

  /**
   * Create a field
   */
  async createField(key: string): Promise<Field[] | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Fields.createField({ key }));
  }

  /**
   * Add a field value to a subscriber (does NOT trigger automations)
   */
  async addField<S = Record<string, unknown>>(
    params: AddFieldParams<S>
  ): Promise<Subscriber<S> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() =>
      sdk.V1.Commands.addField({
        email: params.email,
        field: params.field as { key: string; value: unknown },
      })
    ) as Promise<Subscriber<S> | null>;
  }

  /**
   * Remove a field from a subscriber
   */
  async removeField(
    email: string,
    fieldName: string
  ): Promise<Subscriber<Record<string, unknown>> | null> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Commands.removeField({ email, fieldName }));
  }

  /**
   * Update fields on a subscriber (TRIGGERS automations)
   */
  async updateFields(email: string, fields: Record<string, unknown>): Promise<boolean> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.updateFields({ email, fields }));
  }

  // ============================================================
  // Event Operations
  // ============================================================

  /**
   * Track a custom event (TRIGGERS automations)
   */
  async track(params: TrackEventParams): Promise<boolean> {
    const sdk = await this.getClient();
    return this.handleApiCall(() =>
      sdk.V1.track({
        email: params.email,
        type: params.type as "$custom",
        details: params.details,
        date: params.date,
        fields: {},
      })
    );
  }

  /**
   * Import events in bulk (up to 1000)
   */
  async importEvents(
    events: Array<{
      email: string;
      type: string;
      details?: Record<string, unknown>;
      date?: Date;
    }>
  ): Promise<number> {
    const sdk = await this.getClient();
    return this.handleApiCall(() =>
      sdk.V1.Batch.importEvents({
        events: events.map((e) => ({
          email: e.email,
          type: e.type as "$custom",
          details: e.details,
          date: e.date,
        })),
      })
    );
  }

  // ============================================================
  // Stats Operations
  // ============================================================

  /**
   * Get site statistics
   */
  async getSiteStats(): Promise<SiteStats> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Stats.getSiteStats());
  }

  // ============================================================
  // Broadcast Operations
  // ============================================================

  /**
   * Fetch a single page of broadcasts
   */
  async getBroadcastsPage(
    page = 1,
    perPage = 25
  ): Promise<{ broadcasts: Broadcast[]; total?: number; hasMore: boolean }> {
    type BroadcastListResponse = {
      data?: Broadcast[];
      meta?: { total?: number; count?: number; page?: number; per_page?: number };
    };

    const response = await this.apiGet<BroadcastListResponse | Broadcast[]>(
      "/fetch/broadcasts",
      { page, per_page: perPage }
    );

    const data = Array.isArray(response) ? response : response.data ?? [];
    const meta = Array.isArray(response) ? undefined : response.meta;
    const total = meta?.total;
    const limited = data.slice(0, perPage);
    const hasMore = total !== undefined ? page * perPage < total : data.length >= perPage;

    return { broadcasts: limited, total, hasMore };
  }

  /**
   * List all broadcasts (auto-paginates)
   */
  async getBroadcasts(): Promise<Broadcast[]> {
    const perPage = 100;
    const maxPages = 200;
    const broadcasts: Broadcast[] = [];
    const seenIds = new Set<string>();

    type BroadcastListResponse = {
      data?: Broadcast[];
      meta?: { total?: number; count?: number; page?: number; per_page?: number };
    };

    let page = 1;
    let total: number | undefined;

    while (page <= maxPages) {
      const response = await this.apiGet<BroadcastListResponse | Broadcast[]>(
        "/fetch/broadcasts",
        {
          page,
          per_page: perPage,
        }
      );

      const data = Array.isArray(response) ? response : response.data ?? [];
      const meta = Array.isArray(response) ? undefined : response.meta;

      if (meta?.total !== undefined) {
        total = meta.total;
      }

      if (data.length === 0) {
        break;
      }

      let added = 0;
      for (const item of data) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        broadcasts.push(item);
        added += 1;
      }

      if (total !== undefined && broadcasts.length >= total) {
        break;
      }

      if (added === 0) {
        break;
      }

      page += 1;
    }

    return broadcasts;
  }

  /**
   * Create a new broadcast (draft)
   */
  async createBroadcast(input: CreateBroadcastInput): Promise<Broadcast[]> {
    const sdk = await this.getClient();
    return this.handleApiCall(() => sdk.V1.Broadcasts.createBroadcast([input]));
  }

  // ============================================================
  // Error Handling
  // ============================================================

  /**
   * Wrap API calls with consistent error handling
   */
  private async handleApiCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /**
   * Translate SDK/API errors to CLI-friendly errors
   */
  private translateError(error: unknown): CLIError {
    // Handle SDK-specific error types
    if (error instanceof NotAuthorizedError) {
      return new CLIError(
        "Authentication failed: Invalid API key or insufficient permissions. Run 'bento auth login' to re-authenticate.",
        "AUTH_FAILED",
        401
      );
    }

    if (error instanceof RateLimitedError) {
      return new CLIError(
        "Rate limited: Too many requests. Please wait a moment and try again.",
        "RATE_LIMITED",
        429
      );
    }

    if (error instanceof RequestTimeoutError) {
      return new CLIError(
        "Request timed out. The Bento API may be slow or unreachable. Please try again.",
        "TIMEOUT",
        408
      );
    }

    // Handle generic errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Check for common HTTP status codes in error messages
      if (message.includes("401") || message.includes("unauthorized")) {
        return new CLIError(
          "Authentication failed: Invalid API key or expired credentials. Run 'bento auth login' to re-authenticate.",
          "AUTH_FAILED",
          401
        );
      }

      if (message.includes("403") || message.includes("forbidden")) {
        return new CLIError(
          "Access denied: Your API key does not have permission for this operation.",
          "AUTH_FAILED",
          403
        );
      }

      if (message.includes("404") || message.includes("not found")) {
        return new CLIError("Resource not found.", "NOT_FOUND", 404);
      }

      if (message.includes("429") || message.includes("rate limit")) {
        return new CLIError(
          "Rate limited: Too many requests. Retry in 30 seconds.",
          "RATE_LIMITED",
          429
        );
      }

      if (message.includes("timeout")) {
        return new CLIError("Request timed out. Please try again.", "TIMEOUT", 408);
      }

      if (
        message.includes("422") ||
        message.includes("validation") ||
        message.includes("invalid")
      ) {
        return new CLIError(`Validation error: ${error.message}`, "VALIDATION_ERROR", 422);
      }

      return new CLIError(error.message, "API_ERROR");
    }

    return new CLIError("An unexpected error occurred", "UNKNOWN");
  }

  private async ensureProfileLoaded(): Promise<BentoProfile> {
    if (!this.profile) {
      await this.getClient();
    }

    if (!this.profile) {
      throw new CLIError("Not authenticated. Run 'bento auth login' first.", "AUTH_REQUIRED");
    }

    return this.profile;
  }

  private async apiGet<T>(
    path: string,
    query: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const profile = await this.ensureProfileLoaded();
    const url = new URL(`${this.apiBaseUrl}${path}`);
    url.searchParams.set("site_uuid", profile.siteUuid);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method: "GET",
      headers: this.buildAuthHeaders(profile),
    });

    if (!response.ok) {
      const body = await response.text();
      throw this.createHttpError(response.status, body || response.statusText);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new CLIError("Invalid JSON response from Bento API.", "API_ERROR", response.status);
    }
  }

  private buildAuthHeaders(profile: BentoProfile): Record<string, string> {
    const token = Buffer.from(`${profile.publishableKey}:${profile.secretKey}`).toString("base64");

    return {
      Authorization: `Basic ${token}`,
      "User-Agent": `bento-cli/${profile.siteUuid}`,
      Accept: "application/json",
    };
  }

  private createHttpError(status: number, message: string): CLIError {
    switch (status) {
      case 401:
        return new CLIError(
          "Authentication failed: Invalid credentials. Run 'bento auth login' to re-authenticate.",
          "AUTH_FAILED",
          status
        );
      case 403:
        return new CLIError(
          "Access denied: Your API key does not have permission for this operation.",
          "AUTH_FAILED",
          status
        );
      case 404:
        return new CLIError("Resource not found.", "NOT_FOUND", status);
      case 422:
        return new CLIError(`Validation error: ${message}`, "VALIDATION_ERROR", status);
      case 429:
        return new CLIError(
          "Rate limited: Too many requests. Retry in 30 seconds.",
          "RATE_LIMITED",
          status
        );
      default:
        if (status >= 500) {
          return new CLIError(
            "The Bento API returned a server error. This is usually temporary — please try again in a few moments.",
            "API_ERROR",
            status
          );
        }
        return new CLIError(
          `Request failed (${status}): ${message}`,
          "UNKNOWN",
          status
        );
    }
  }
}

// Singleton instance for normal usage
export const bento = new BentoClient();

// Convenience function for credential validation
export async function validateCredentials(
  publishableKey: string,
  secretKey: string,
  siteUuid: string
): Promise<boolean> {
  return new BentoClient().validateCredentials(publishableKey, secretKey, siteUuid);
}

// Re-export CLIError for commands to use
export { CLIError as SDKError };
