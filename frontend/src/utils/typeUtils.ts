import { formatDistanceToNow } from 'date-fns';

/**
 * Utility to safely parse dates from API responses
 * Handles both ISO strings and Unix timestamps
 */
export function parseDate(value: string | number | null | undefined): Date | null {
  if (!value) return null;
  
  const date = new Date(value);
  return !isNaN(date.getTime()) ? date : null;
}

/**
 * Format date for display with fallback
 */
export function formatDate(
  value: string | number | null | undefined,
  formatter: (date: Date) => string,
  fallback: string = 'Unknown'
): string {
  const date = parseDate(value);
  return date ? formatter(date) : fallback;
}

/**
 * Format date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  value: string | number | null | undefined,
  fallback: string = 'Unknown'
): string {
  return formatDate(
    value,
    (date) => formatDistanceToNow(date, { addSuffix: true }),
    fallback
  );
}

/**
 * Parse BigInt string to number (for display purposes)
 * Note: Only safe for values within Number.MAX_SAFE_INTEGER
 */
export function parseBigIntString(value: string | null | undefined): number | null {
  if (!value) return null;
  
  try {
    const num = parseInt(value, 10);
    return !isNaN(num) ? num : null;
  } catch {
    return null;
  }
}

/**
 * Get timestamp from alert (handles both createdAt and legacy timestamp)
 */
export function getAlertTimestamp(alert: { createdAt?: string | number; timestamp?: number }): string | number | null {
  return alert.createdAt || alert.timestamp || null;
}

/**
 * Check if a date value is valid
 */
export function isValidDate(value: string | number | null | undefined): boolean {
  return parseDate(value) !== null;
}
