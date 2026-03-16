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

// Sequence types
export type {
  Sequence,
  SequenceAttributes,
  SequenceEmailTemplate,
} from "@bentonow/bento-node-sdk/src/sdk/sequences/types";

// Email template types
export type { EmailTemplate } from "@bentonow/bento-node-sdk/src/sdk/email-templates/types";

// Workflow types
export type {
  Workflow,
  WorkflowAttributes,
} from "@bentonow/bento-node-sdk/src/sdk/workflows/types";

// Form types
export type {
  FormResponse,
  FormResponseAttributes,
} from "@bentonow/bento-node-sdk/src/sdk/forms/types";

// Experimental types
export type {
  GuessGenderResponse,
  BlacklistResponse,
  ContentModerationResult,
} from "@bentonow/bento-node-sdk/src/sdk/experimental/types";

// Batch/transactional types
export type { TransactionalEmail } from "@bentonow/bento-node-sdk/src/sdk/batch/types";

// Purchase types
export type {
  PurchaseDetails,
  PurchaseCart,
  PurchaseItem,
} from "@bentonow/bento-node-sdk/src/sdk/batch/events";

// Base entity type
export type { BaseEntity } from "@bentonow/bento-node-sdk/src/sdk/types";

export type SequenceDelayInterval = "minutes" | "hours" | "days" | "months";

export interface CreateSequenceEmailParameters {
  subject: string;
  html: string;
  inbox_snippet?: string;
  delay_interval?: SequenceDelayInterval;
  delay_interval_count?: number;
  editor_choice?: string;
  cc?: string;
  bcc?: string;
  to?: string;
}

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
}

export interface SubscriberSearchResult {
  subscriber: Subscriber<Record<string, unknown>> | null;
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
