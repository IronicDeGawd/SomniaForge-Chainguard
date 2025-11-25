export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertType = 
  | 'REENTRANCY' 
  | 'ACCESS_CONTROL' 
  | 'UNCHECKED_CALL' 
  | 'GAS_ANOMALY'
  | 'FLASH_LOAN'
  | 'PRICE_MANIPULATION';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  contractAddress: string;
  contractName?: string;
  description: string;
  timestamp: number;
  txHash?: string;
  recommendation?: string;
  dismissed: boolean;
}

export type ContractStatus = 'healthy' | 'warning' | 'critical';

export interface Finding {
  type: string;
  severity: AlertSeverity;
  description: string;
  line?: number;
  recommendation: string;
}

export interface Contract {
  address: string;
  name?: string;
  network?: string;
  status: ContractStatus;
  totalTxs: number;
  failedTxs: number;
  avgGas: number;
  lastActivity: string;
  findings?: Finding[];
  alerts?: Alert[];
}

export interface NetworkExploit {
  id: string;
  type: string;
  exploitedContract: string;
  valueLost?: string;
  timestamp: number;
  pattern: string;
  similarContracts: string[];
}

export interface Transaction {
  hash: string;
  status: 'success' | 'failed';
  gasUsed: number;
  timestamp: number;
}

export interface GasDataPoint {
  timestamp: number;
  gas: number;
  anomaly?: boolean;
}

export interface WebSocketEvents {
  transaction: (tx: Transaction) => void;
  alert: (alert: Alert) => void;
  connect: () => void;
  disconnect: () => void;
}

export interface Stats {
  totalContracts: number;
  activeAlerts: number;
  vulnerabilities24h: number;
  gasAnomalies: number;
}
