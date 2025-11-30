export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'FALSE_POSITIVE';

export type AlertType = 
  | 'REENTRANCY' 
  | 'ACCESS_CONTROL' 
  | 'UNCHECKED_CALL' 
  | 'GAS_ANOMALY'
  | 'FLASH_LOAN'
  | 'FLASH_LOAN_ATTACK'  // Backend behavioral heuristic type
  | 'PRICE_MANIPULATION'
  | 'MONITORING_FAILURE'
  | 'SPAM_ATTACK'
  | 'SUSPICIOUS_ACTIVITY'
  | 'DDOS_ATTACK'
  | 'HIGH_FREQUENCY_BOT'
  | 'GOVERNANCE_ATTACK'
  | 'CONTRACT_DEPLOYMENT';

export type ContractStatus = 'pending' | 'healthy' | 'warning' | 'critical' | 'error';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  contractAddress: string;
  contractName?: string;
  description: string;
  recommendation?: string;
  txHash?: string;
  dismissed: boolean;
  
  // LLM Validation fields
  llmValid?: boolean;
  llmConfidence?: number; // 0-100
  llmReason?: string;
  llmContext?: string;
  
  // Timestamps
  createdAt: string; // ISO string from API
  updatedAt: string; // ISO string from API
  
  // Legacy field - deprecated, use createdAt
  timestamp?: number;
  
  // Nested relations
  contract?: Partial<Contract>;
}

export interface Finding {
  id: string;
  contractAddress: string;
  type: string;
  severity: AlertSeverity;
  line?: number;
  functionName?: string;
  codeSnippet?: string;
  ruleConfidence: number; // 0-1 from rule engine
  description?: string;
  validated: boolean;
  createdAt: string; // ISO string from API
  
  // Nested relations
  contract?: Partial<Contract>;
}

export interface Contract {
  id: string;
  address: string;
  name?: string;
  network: string; // 'testnet' or 'mainnet'
  status: ContractStatus;
  statusMessage?: string;
  totalTxs: number;
  failedTxs: number;
  avgGas: number;
  lastActivity: string; // ISO string from API
  createdAt: string; // ISO string from API
  updatedAt: string; // ISO string from API
  
  // Block tracking
  lastProcessedBlock?: string; // BigInt serialized as string
  lastProcessedTxHash?: string;
  
  // Baseline metrics for anomaly detection
  baselineGas: number;
  baselineGasStdDev: number;
  baselineTxFrequency: number; // Transactions per day
  baselineValue: string;
  baselineValueStdDev: string;
  baselineLastUpdated?: string; // ISO string from API
  
  // Ownership
  ownerId?: string;
  owner?: User;
  
  // Nested relations
  findings?: Finding[];
  alerts?: Alert[];
  transactions?: Transaction[];
  
  // Aggregated counts from API
  _count?: {
    findings: number;
    alerts: number;
    transactions: number;
  };
}

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  value: string; // Wei amount as string
  gasUsed: number;
  status: 'success' | 'failed';
  timestamp: string; // ISO string from API
  contractAddress?: string;
  blockNumber?: string; // BigInt serialized as string
  createdAt: string; // ISO string from API
  
  // Nested relations
  contract?: Partial<Contract>;
}

export interface User {
  id: string;
  address: string;
  createdAt: string; // ISO string from API
  
  // Nested relations
  contracts?: Contract[];
}

export interface FailedMonitor {
  id: string;
  contractAddress: string;
  network: string;
  reason: string;
  attempts: number;
  lastAttempt: string; // ISO string from API
  resolved: boolean;
  resolvedAt?: string; // ISO string from API
  createdAt: string; // ISO string from API
}

export interface FunctionGasProfile {
  id: string;
  contractAddress: string;
  functionSelector: string; // 0x12345678
  functionName?: string; // transfer, swap, etc.
  avgGas: number;
  minGas: number;
  maxGas: number;
  stdDevGas: number;
  callCount: number;
  createdAt: string; // ISO string from API
  lastUpdated: string; // ISO string from API
}

// Legacy types - kept for backwards compatibility
export interface NetworkExploit {
  id: string;
  type: string;
  exploitedContract: string;
  valueLost?: string;
  timestamp: number;
  pattern: string;
  similarContracts: string[];
  severity?: string;
}

export interface GasDataPoint {
  timestamp: number;
  gas: number;
  anomaly?: boolean;
}

export interface WebSocketEvents {
  transaction: (tx: Transaction) => void;
  alert: (alert: Alert) => void;
  contract_update: (contract: Contract) => void;
  new_finding: (finding: Finding) => void;
  monitoring_failure: (data: { contractAddress: string; network: string; message: string; severity: string; attempts: number }) => void;
  connect: () => void;
  disconnect: () => void;
}

export interface Stats {
  totalContracts: number;
  activeAlerts: number;
  vulnerabilities24h: number;
  gasAnomalies: number;
  totalTransactions?: number;
}

export interface NetworkStats {
  totalTransactions: number;
  flashLoans: number;
  reentrancyAttempts: number;
  suspiciousPatterns: number;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    cursor?: string;
  };
}
