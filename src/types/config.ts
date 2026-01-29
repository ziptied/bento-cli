/**
 * TypeScript interfaces for Bento CLI configuration
 */

export interface BentoProfile {
  publishableKey: string;
  secretKey: string;
  siteUuid: string;
  createdAt: string;
  updatedAt: string;
}

export interface BentoConfig {
  version: 1;
  current: string | null;
  profiles: Record<string, BentoProfile>;
}

export const DEFAULT_CONFIG: BentoConfig = {
  version: 1,
  current: null,
  profiles: {},
};

export type ProfileInput = Omit<BentoProfile, "createdAt" | "updatedAt">;

/**
 * Legacy profile format for migration support
 */
export interface LegacyBentoProfile {
  apiKey: string;
  siteId: string;
  createdAt?: string;
  updatedAt?: string;
}
