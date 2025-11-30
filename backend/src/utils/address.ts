/**
 * Address Normalization Utilities
 * Ensures consistent handling of Ethereum addresses throughout the application
 */

/**
 * Normalize an Ethereum address to lowercase
 * @param address - Ethereum address (with or without 0x prefix)
 * @returns Normalized lowercase address with 0x prefix
 * @throws Error if address format is invalid
 */
export function normalizeAddress(address: string): string {
  if (!address) {
    throw new Error('Address is required');
  }

  // Remove any whitespace
  const trimmed = address.trim();

  // Validate format: Must be 0x followed by 40 hex characters
  if (!trimmed.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error(`Invalid Ethereum address format: ${trimmed}`);
  }

  // Return lowercase version for consistent storage
  return trimmed.toLowerCase();
}

/**
 * Validate that a string is a valid Ethereum address
 * @param address - String to validate
 * @returns true if valid Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;

  const trimmed = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

/**
 * Compare two addresses for equality (case-insensitive)
 * @param address1 - First address
 * @param address2 - Second address
 * @returns true if addresses are equal (ignoring case)
 */
export function addressesEqual(address1: string, address2: string): boolean {
  if (!address1 || !address2) return false;

  try {
    return normalizeAddress(address1) === normalizeAddress(address2);
  } catch {
    return false;
  }
}

/**
 * Truncate address for display (0x1234...5678)
 * @param address - Full Ethereum address
 * @param prefixLength - Number of characters after 0x to show at start (default: 4)
 * @param suffixLength - Number of characters to show at end (default: 4)
 * @returns Truncated address
 */
export function truncateAddress(
  address: string,
  prefixLength: number = 4,
  suffixLength: number = 4
): string {
  if (!isValidAddress(address)) return address;

  const normalized = normalizeAddress(address);
  return `${normalized.slice(0, 2 + prefixLength)}...${normalized.slice(-suffixLength)}`;
}
