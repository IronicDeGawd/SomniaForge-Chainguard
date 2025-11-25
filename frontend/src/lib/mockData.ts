import { Alert, Contract, NetworkExploit, Transaction, GasDataPoint } from '@/types';

export const mockAlerts: Alert[] = [
  {
    id: '1',
    severity: 'CRITICAL',
    type: 'REENTRANCY',
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    contractName: 'DeFi Vault v2',
    description: 'Reentrancy vulnerability detected in withdraw function',
    timestamp: Date.now() - 120000,
    txHash: '0x1a2b3c4d5e6f7g8h9i0j',
    recommendation: 'Implement checks-effects-interactions pattern',
    dismissed: false,
  },
  {
    id: '2',
    severity: 'HIGH',
    type: 'ACCESS_CONTROL',
    contractAddress: '0x8b3f7f9c4e2d1a5b6c7d8e9f0a1b2c3d4e5f6',
    contractName: 'TokenSwap',
    description: 'Missing access control on admin function',
    timestamp: Date.now() - 300000,
    recommendation: 'Add onlyOwner modifier to sensitive functions',
    dismissed: false,
  },
  {
    id: '3',
    severity: 'CRITICAL',
    type: 'FLASH_LOAN',
    contractAddress: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    contractName: 'LiquidityPool',
    description: 'Flash loan attack detected - $2.3M at risk',
    timestamp: Date.now() - 180000,
    txHash: '0xflash123attack456',
    recommendation: 'Implement flash loan protection mechanisms',
    dismissed: false,
  },
  {
    id: '4',
    severity: 'MEDIUM',
    type: 'GAS_ANOMALY',
    contractAddress: '0xa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
    description: 'Unusual gas consumption pattern detected',
    timestamp: Date.now() - 420000,
    recommendation: 'Review recent transactions for optimization',
    dismissed: false,
  },
  {
    id: '5',
    severity: 'HIGH',
    type: 'UNCHECKED_CALL',
    contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    contractName: 'PaymentGateway',
    description: 'Unchecked external call in payment function',
    timestamp: Date.now() - 600000,
    recommendation: 'Add proper error handling and return value checks',
    dismissed: false,
  },
  {
    id: '6',
    severity: 'LOW',
    type: 'GAS_ANOMALY',
    contractAddress: '0xabcdef1234567890abcdef1234567890abcdef',
    description: 'Minor gas optimization opportunity detected',
    timestamp: Date.now() - 900000,
    recommendation: 'Consider using unchecked blocks for safe arithmetic',
    dismissed: false,
  },
];

export const mockContracts: Contract[] = [
  {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    name: 'DeFi Vault v2',
    status: 'critical',
    totalTxs: 1247,
    failedTxs: 3,
    avgGas: 125000,
    lastActivity: Date.now() - 120000,
    findings: [
      {
        type: 'Reentrancy',
        severity: 'CRITICAL',
        description: 'Potential reentrancy in withdraw function',
        line: 145,
        recommendation: 'Use ReentrancyGuard or checks-effects-interactions',
      },
    ],
  },
  {
    address: '0x8b3f7f9c4e2d1a5b6c7d8e9f0a1b2c3d4e5f6',
    name: 'TokenSwap',
    status: 'warning',
    totalTxs: 3421,
    failedTxs: 8,
    avgGas: 98000,
    lastActivity: Date.now() - 300000,
    findings: [
      {
        type: 'Access Control',
        severity: 'HIGH',
        description: 'Missing access control on admin functions',
        recommendation: 'Implement role-based access control',
      },
    ],
  },
  {
    address: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    name: 'LiquidityPool',
    status: 'critical',
    totalTxs: 8932,
    failedTxs: 12,
    avgGas: 156000,
    lastActivity: Date.now() - 60000,
    findings: [
      {
        type: 'Flash Loan',
        severity: 'CRITICAL',
        description: 'Vulnerable to flash loan attacks',
        recommendation: 'Add flash loan protection and price oracle validation',
      },
    ],
  },
  {
    address: '0xa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8',
    name: 'NFT Marketplace',
    status: 'healthy',
    totalTxs: 5621,
    failedTxs: 2,
    avgGas: 87000,
    lastActivity: Date.now() - 420000,
    findings: [],
  },
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'PaymentGateway',
    status: 'warning',
    totalTxs: 2145,
    failedTxs: 5,
    avgGas: 112000,
    lastActivity: Date.now() - 600000,
    findings: [
      {
        type: 'Unchecked Call',
        severity: 'HIGH',
        description: 'External call without proper error handling',
        line: 89,
        recommendation: 'Check return values and handle errors',
      },
    ],
  },
];

export const mockExploits: NetworkExploit[] = [
  {
    id: 'exploit-1',
    type: 'Reentrancy + Flash Loan',
    exploitedContract: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    valueLost: '$2,300,000',
    timestamp: Date.now() - 180000,
    pattern: 'Flash loan followed by recursive calls to drain liquidity',
    similarContracts: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],
  },
  {
    id: 'exploit-2',
    type: 'Price Manipulation',
    exploitedContract: '0xdeadbeef1234567890abcdef1234567890abcd',
    valueLost: '$850,000',
    timestamp: Date.now() - 7200000,
    pattern: 'Oracle manipulation through flash swaps',
    similarContracts: [],
  },
];

export const mockTransactions: Transaction[] = Array.from({ length: 20 }, (_, i) => ({
  hash: `0x${Math.random().toString(16).slice(2, 42)}`,
  status: Math.random() > 0.1 ? 'success' : 'failed',
  gasUsed: Math.floor(Math.random() * 200000) + 50000,
  timestamp: Date.now() - i * 30000,
}));

export const mockGasData: GasDataPoint[] = Array.from({ length: 48 }, (_, i) => {
  const baseGas = 100000;
  const variation = Math.random() * 50000;
  const isAnomaly = Math.random() > 0.95;
  
  return {
    timestamp: Date.now() - (48 - i) * 1800000, // 30 min intervals
    gas: Math.floor(baseGas + variation + (isAnomaly ? 100000 : 0)),
    anomaly: isAnomaly,
  };
});
