/**
 * Bento Node SDK wrapper
 *
 * All API operations go through this module to:
 * - Centralize auth/profile handling
 * - Provide consistent error transformation
 * - Enable easy mocking in tests
 * - Add logging, rate limiting, retries
 *
 * Commands should NEVER instantiate BentoClient directly.
 */

import { getCurrentProfile } from "./config";

// TODO: Import from @bentonow/bento-node-sdk when available
// import { BentoClient } from "@bentonow/bento-node-sdk";

export class SDKError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "SDKError";
  }
}

async function getClient() {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new SDKError(
      "Not authenticated. Run 'bento auth login' to authenticate.",
      "NOT_AUTHENTICATED"
    );
  }

  // TODO: Return BentoClient instance
  // return new BentoClient({
  //   apiKey: profile.apiKey,
  //   siteId: profile.siteId,
  // });
  return null;
}

function transformError(error: unknown): SDKError {
  if (error instanceof SDKError) {
    return error;
  }

  if (error instanceof Error) {
    return new SDKError(error.message);
  }

  return new SDKError("An unknown error occurred");
}

// Subscriber operations
export async function searchSubscribers(_options: {
  email?: string;
  limit?: number;
}) {
  const _client = await getClient();
  try {
    // TODO: Implement with SDK
    return [];
  } catch (error) {
    throw transformError(error);
  }
}

export async function importSubscribers(_options: {
  data: unknown[];
  limit?: number;
}) {
  const _client = await getClient();
  try {
    // TODO: Implement with SDK
    return { imported: 0, skipped: 0, errors: 0 };
  } catch (error) {
    throw transformError(error);
  }
}

// Tag operations
export async function listTags() {
  const _client = await getClient();
  try {
    // TODO: Implement with SDK
    return [];
  } catch (error) {
    throw transformError(error);
  }
}

export async function createTag(name: string) {
  const _client = await getClient();
  try {
    // TODO: Implement with SDK
    return { name };
  } catch (error) {
    throw transformError(error);
  }
}

// Event operations
export async function trackEvent(_options: {
  email: string;
  event: string;
  value?: number;
}) {
  const _client = await getClient();
  try {
    // TODO: Implement with SDK
    return { success: true };
  } catch (error) {
    throw transformError(error);
  }
}
