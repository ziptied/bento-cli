export type OutputMode = "normal" | "json" | "quiet";

export interface CLIResponse<T> {
  success: boolean;
  error: string | null;
  data: T;
  meta?: {
    count: number;
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
    code?: number;
    hint?: string;
    [key: string]: unknown;
  };
}

export interface TableColumn<T extends Record<string, unknown>> {
  key: keyof T;
  header?: string;
  formatter?: (value: unknown, row: T) => string;
  align?: "left" | "center" | "right";
}

export interface TableOptions<T extends Record<string, unknown>> {
  columns?: TableColumn<T>[];
  emptyMessage?: string;
  meta?: {
    total?: number;
  };
}

export interface ProgressBarOptions {
  label?: string;
  width?: number;
  force?: boolean;
}

export interface ProgressBarHandle {
  update(completed: number, label?: string): void;
  increment(step?: number, label?: string): void;
  stop(message?: string): void;
}
