/**
 * SDK-related type definitions for Bento CLI
 *
 * Re-exports relevant types from @bentonow/bento-node-sdk and defines
 * CLI-specific interfaces for SDK operations.
 */

// Re-export SDK types that commands will use
export type {
  AnalyticsOptions,
  AuthenticationOptions,
  ClientOptions,
} from "@bentonow/bento-node-sdk/src/sdk/interfaces";

// Subscriber types
export type {
  Subscriber,
  SubscriberAttributes,
} from "@bentonow/bento-node-sdk/src/sdk/subscribers/types";

// Tag types
export type { Tag, TagAttributes } from "@bentonow/bento-node-sdk/src/sdk/tags/types";

// Field types
export type { Field, FieldAttributes } from "@bentonow/bento-node-sdk/src/sdk/fields/types";

// Stats types
export type {
  SiteStats,
  SegmentStats,
  ReportStats,
} from "@bentonow/bento-node-sdk/src/sdk/stats/types";

// Broadcast types
export type {
  Broadcast,
  BroadcastAttributes,
  BroadcastType,
  CreateBroadcastInput,
} from "@bentonow/bento-node-sdk/src/sdk/broadcasts/types";

// Base entity type
export type { BaseEntity } from "@bentonow/bento-node-sdk/src/sdk/types";

/**
 * CLI error codes for SDK operations
 */
export type SDKErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "VALIDATION_ERROR"
  | "API_ERROR"
  | "UNKNOWN";

/**
 * Parameters for fetching a single subscriber
 */
export interface GetSubscriberParams {
  email?: string;
  uuid?: string;
}

export interface FieldFilter {
  key: string;
  value: string;
  operator?: "eq" | "contains";
}

export interface SubscriberSearchParams extends GetSubscriberParams {
  tag?: string;
  fields?: FieldFilter[];
  page?: number;
  perPage?: number;
}

export interface SubscriberSearchMeta {
  page: number;
  perPage: number;
  total?: number;
  count: number;
  hasMore?: boolean;
}

export interface SubscriberSearchResult {
  subscribers: Subscriber<Record<string, unknown>>[];
  meta: SubscriberSearchMeta;
}

/**
 * Parameters for importing subscribers in bulk
 */
export interface ImportSubscribersParams<S = Record<string, unknown>> {
  subscribers: ({ email: string } & Partial<S>)[];
}

/**
 * Parameters for tracking events
 */
export interface TrackEventParams {
  email: string;
  type: string;
  details?: Record<string, unknown>;
  date?: Date;
}

/**
 * Parameters for tagging a subscriber
 */
export interface TagSubscriberParams {
  email: string;
  tagName: string;
}

/**
 * Parameters for adding a field to a subscriber
 */
export interface AddFieldParams<S = Record<string, unknown>> {
  email: string;
  field: { key: keyof S; value: S[keyof S] };
}

/**
 * Result of a batch import operation
 */
export interface ImportResult {
  imported: number;
  failed?: number;
}
