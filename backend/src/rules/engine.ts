import prisma from '../db/prisma.js';
import { io } from '../server.js';

/**
 * Rule Engine for Vulnerability Detection
 * Analyzes transactions for common smart contract vulnerabilities
 */

export interface Finding {
  type: string;
  severity: string;
  contractAddress: string;
  functionName?: string;
  line?: number;
  codeSnippet?: string;
  ruleConfidence: number;
  description: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  input: string;
  gasUsed: number;
  status: string;
}

/**
 * Analyze a transaction for vulnerabilities
 */
export async function analyzeTransaction(tx: Transaction): Promise<Finding[]> {
  const findings: Finding[] = [];
  
  // Rule 1: Reentrancy Detection
  if (detectReentrancy(tx)) {
    findings.push({
      type: 'REENTRANCY',
      severity: 'CRITICAL',
      contractAddress: tx.to,
      ruleConfidence: 0.85,
      description: 'Potential reentrancy vulnerability detected - external call before state update'
    });
  }
  
  // Rule 2: Access Control
  if (detectMissingAccessControl(tx)) {
    findings.push({
      type: 'ACCESS_CONTROL',
      severity: 'HIGH',
      contractAddress: tx.to,
      ruleConfidence: 0.75,
      description: 'Missing access control on sensitive function'
    });
  }
  
  // Rule 3: Unchecked External Call
  if (detectUncheckedCall(tx)) {
    findings.push({
      type: 'UNCHECKED_CALL',
      severity: 'HIGH',
      contractAddress: tx.to,
      ruleConfidence: 0.80,
      description: 'External call without success check'
    });
  }
  
  // Rule 4: Gas Anomaly
  const gasAnomaly = await detectGasAnomaly(tx);
  if (gasAnomaly) {
    findings.push(gasAnomaly);
  }
  
  // Store findings in database
  for (const finding of findings) {
    await prisma.finding.create({
      data: {
        contractAddress: finding.contractAddress,
        type: finding.type,
        severity: finding.severity,
        line: finding.line,
        functionName: finding.functionName,
        codeSnippet: finding.codeSnippet,
        ruleConfidence: finding.ruleConfidence
      }
    });
  }
  
  return findings;
}

/**
 * Rule 1: Reentrancy Detection
 * Checks for external calls before state updates
 */
function detectReentrancy(tx: Transaction): boolean {
  const input = tx.input.toLowerCase();
  
  // Simple pattern matching for external calls
  // In production, this would analyze bytecode or use static analysis
  const hasExternalCall = input.includes('call') || input.includes('delegatecall');
  const lacksReentrancyGuard = !input.includes('nonreentrant') && !input.includes('mutex');
  
  return hasExternalCall && lacksReentrancyGuard;
}

/**
 * Rule 2: Access Control Detection
 * Checks for admin functions without modifiers
 */
function detectMissingAccessControl(tx: Transaction): boolean {
  const input = tx.input.toLowerCase();
  
  // Check for admin function signatures
  const adminFunctions = ['mint', 'burn', 'pause', 'unpause', 'setowner', 'transferownership'];
  const hasAdminFunction = adminFunctions.some(fn => input.includes(fn));
  
  // Check for access control modifiers
  const hasModifier = input.includes('onlyowner') || input.includes('onlyadmin') || input.includes('require');
  
  return hasAdminFunction && !hasModifier;
}

/**
 * Rule 3: Unchecked External Call Detection
 * Checks for external calls without return value checks
 */
function detectUncheckedCall(tx: Transaction): boolean {
  const input = tx.input.toLowerCase();
  
  // Check for low-level calls
  const hasLowLevelCall = input.includes('.call') || input.includes('.delegatecall');
  
  // Check for return value handling
  const hasReturnCheck = input.includes('require') || input.includes('assert') || input.includes('if');
  
  return hasLowLevelCall && !hasReturnCheck;
}

/**
 * Rule 4: Gas Anomaly Detection
 * Detects unusual gas consumption patterns
 */
async function detectGasAnomaly(tx: Transaction): Promise<Finding | null> {
  try {
    // Get average gas for this contract
    const avgGasResult = await prisma.transaction.aggregate({
      where: { to: tx.to },
      _avg: { gasUsed: true },
      _count: true
    });
    
    // Need at least 5 transactions to establish baseline
    if (!avgGasResult._count || avgGasResult._count < 5) {
      return null;
    }
    
    const baseline = avgGasResult._avg.gasUsed || 100000;
    const threshold = baseline * 2; // 2x baseline is anomalous
    
    if (tx.gasUsed > threshold) {
      const percentIncrease = ((tx.gasUsed / baseline - 1) * 100).toFixed(0);
      
      return {
        type: 'GAS_ANOMALY',
        severity: tx.gasUsed > baseline * 3 ? 'HIGH' : 'MEDIUM',
        contractAddress: tx.to,
        ruleConfidence: 0.70,
        description: `Gas usage (${tx.gasUsed}) exceeds baseline (${Math.round(baseline)}) by ${percentIncrease}%`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting gas anomaly:', error);
    return null;
  }
}

/**
 * Process a new transaction
 * Called by the monitoring service
 */
export async function processTransaction(tx: Transaction) {
  try {
    // Store transaction
    await prisma.transaction.create({
      data: {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gasUsed: tx.gasUsed,
        status: tx.status,
        timestamp: new Date(),
        contractAddress: tx.to
      }
    });
    
    // Run rule engine
    const findings = await analyzeTransaction(tx);
    
    // Emit transaction event to frontend
    io.emit('transaction', {
      hash: tx.hash,
      to: tx.to,
      gasUsed: tx.gasUsed,
      status: tx.status,
      findingsCount: findings.length
    });
    
    return findings;
  } catch (error) {
    console.error('Error processing transaction:', error);
    return [];
  }
}
