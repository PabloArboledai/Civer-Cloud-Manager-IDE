import { sanitizeObject } from './sensitiveDataMasking';

export const DEBUG_HEARTBEAT_INTERVAL_MS = 1000;

const MAX_DEBUG_STRING_LENGTH = 240;
const MAX_DEBUG_ARRAY_ITEMS = 8;
const MAX_DEBUG_OBJECT_KEYS = 20;
const MAX_DEBUG_DEPTH = 4;

export interface DebugEvent {
  scope: string;
  source: string;
  action: string;
  at: string;
  detail?: unknown;
}

function truncateDebugString(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= MAX_DEBUG_STRING_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_DEBUG_STRING_LENGTH)}...(${normalized.length - MAX_DEBUG_STRING_LENGTH} more chars)`;
}

function summarizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateDebugString(value.message),
      stack: value.stack ? truncateDebugString(value.stack) : undefined,
    };
  }

  if (typeof value === 'string') {
    return truncateDebugString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (depth >= MAX_DEBUG_DEPTH) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }

    return '[Object]';
  }

  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      items: value.slice(0, MAX_DEBUG_ARRAY_ITEMS).map((item) => summarizeValue(item, depth + 1)),
      truncatedItems:
        value.length > MAX_DEBUG_ARRAY_ITEMS ? value.length - MAX_DEBUG_ARRAY_ITEMS : undefined,
    };
  }

  const summary: Record<string, unknown> = {};
  const entries = Object.entries(value);

  for (const [key, entryValue] of entries.slice(0, MAX_DEBUG_OBJECT_KEYS)) {
    summary[key] = summarizeValue(entryValue, depth + 1);
  }

  if (entries.length > MAX_DEBUG_OBJECT_KEYS) {
    summary.__truncatedKeys = entries.length - MAX_DEBUG_OBJECT_KEYS;
  }

  return summary;
}

export function summarizeForDebug(value: unknown): unknown {
  return summarizeValue(sanitizeObject(value), 0);
}

export function createDebugEvent(
  scope: string,
  source: string,
  action: string,
  detail?: unknown,
): DebugEvent {
  return {
    scope,
    source,
    action,
    at: new Date().toISOString(),
    detail: detail === undefined ? undefined : summarizeForDebug(detail),
  };
}

export function formatDebugEvent(event: Pick<DebugEvent, 'scope' | 'source' | 'action'>): string {
  return `[trace:${event.scope}] ${event.source}:${event.action}`;
}
