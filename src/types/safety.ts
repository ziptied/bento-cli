export interface SafetyOptions {
  dryRun: boolean;
  limit?: number;
  sample?: number;
  confirm: boolean;
}

export interface BulkOperation<T, R> {
  name: string;
  items: T[];
  execute: (items: T[]) => Promise<R>;
  preview?: (items: T[]) => void | Promise<void>;
  formatItem?: (item: T, index: number) => Record<string, unknown>;
  isDangerous?: boolean;
}

export interface SafetyConfig {
  confirmThreshold: number;
  defaultSampleSize: number;
}
