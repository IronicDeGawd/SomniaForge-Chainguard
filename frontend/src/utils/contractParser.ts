import { isAddress } from 'viem';

export interface ParsedContract {
  name: string;
  address: string;
}

/**
 * Parses text to extract contract names and addresses.
 * Supported formats:
 * - Name: 0xAddress
 * - Name 0xAddress
 * - 0xAddress (Name defaults to "Contract N")
 * - 0xAddress Name
 */
export function parseContractText(text: string): ParsedContract[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const parsed: ParsedContract[] = [];
  let contractCounter = 1;

  // Regex for Ethereum address
  const addressRegex = /(0x[a-fA-F0-9]{40})/;

  for (const line of lines) {
    const match = line.match(addressRegex);
    if (match) {
      const address = match[0];
      if (!isAddress(address)) continue;

      // Remove the address from the line to find the name
      let name = line.replace(address, '').trim();

      // Clean up common separators
      name = name.replace(/^[:\-\s]+|[:\-\s]+$/g, '');

      // If no name found, generate a default one
      if (!name) {
        name = `Contract ${contractCounter++}`;
      }

      parsed.push({ name, address });
    }
  }

  return parsed;
}
