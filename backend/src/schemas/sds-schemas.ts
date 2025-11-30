/**
 * SDS (Somnia Data Streams) Schema Definitions
 *
 * IMPORTANT: These schemas are for PUBLISHING/READING structured data to/from chain,
 * NOT for subscription filtering. The SDS subscribe() method does NOT support
 * schema-based filtering - it uses event-based filtering instead.
 *
 * Current use: Reference documentation only
 * Potential use: Publishing structured monitoring data to chain (future feature)
 *
 * For subscription filtering, see: backend/src/services/monitor.ts (event-based)
 * For detection filtering, see: backend/src/rules/engine.ts (heuristics)
 */

/**
 * Transaction Result Schema
 * Captures transaction execution details including success/failure, gas, and revert reasons
 */
export const TX_RESULT_SCHEMA = `
  address contractAddress,
  bytes32 txHash,
  address from,
  bytes4 functionSelector,
  bool success,
  string revertReason,
  uint256 gasUsed,
  uint256 gasLimit,
  uint256 value,
  uint256 timestamp
`;

/**
 * State Change Schema
 * Tracks storage slot modifications for detecting suspicious state changes
 */
export const STATE_CHANGE_SCHEMA = `
  address contractAddress,
  bytes32 storageSlot,
  bytes32 oldValue,
  bytes32 newValue,
  bytes32 txHash,
  uint256 blockNumber,
  uint256 timestamp
`;

/**
 * Gas Anomaly Schema
 * Monitors abnormal gas consumption patterns that may indicate attacks
 */
export const GAS_ANOMALY_SCHEMA = `
  address contractAddress,
  bytes4 functionSelector,
  uint256 gasUsed,
  uint256 baseline,
  uint256 deviation,
  string severity,
  uint256 timestamp
`;

/**
 * Event Log Schema
 * Captures contract events for analysis
 */
export const EVENT_LOG_SCHEMA = `
  address contractAddress,
  bytes32 eventSignature,
  bytes32[] topics,
  bytes data,
  bytes32 txHash,
  uint256 blockNumber,
  uint256 timestamp
`;

/**
 * Schema Types for TypeScript type safety
 */
export interface TxResultData {
  contractAddress: string;
  txHash: string;
  from: string;
  functionSelector: string;
  success: boolean;
  revertReason: string;
  gasUsed: bigint;
  gasLimit: bigint;
  value: bigint;
  timestamp: bigint;
}

export interface StateChangeData {
  contractAddress: string;
  storageSlot: string;
  oldValue: string;
  newValue: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: bigint;
}

export interface GasAnomalyData {
  contractAddress: string;
  functionSelector: string;
  gasUsed: bigint;
  baseline: bigint;
  deviation: bigint;
  severity: string;
  timestamp: bigint;
}

export interface EventLogData {
  contractAddress: string;
  eventSignature: string;
  topics: string[];
  data: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: bigint;
}

/**
 * SDS Filter Configurations
 * Pre-defined filters for common security monitoring scenarios
 */
export const FILTERS = {
  // Only failed transactions or high gas usage
  SUSPICIOUS_TXS: {
    OR: [
      { success: false },
      { gasUsed: { gt: 200000 } }
    ]
  },

  // Only critical state changes (specific slots)
  CRITICAL_STATE_CHANGES: {
    storageSlot: {
      in: [
        '0x0000000000000000000000000000000000000000000000000000000000000000', // Owner slot
        '0x0000000000000000000000000000000000000000000000000000000000000001'  // Paused slot
      ]
    }
  },

  // Only high-severity gas anomalies
  HIGH_GAS_ANOMALIES: {
    severity: { in: ['HIGH', 'CRITICAL'] },
    deviation: { gt: 50 }  // >50% deviation
  }
};
