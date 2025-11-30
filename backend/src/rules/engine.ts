import prisma from '../db/prisma.js';
import { io } from '../server.js';
import { formatEther } from 'viem';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { queueValidation } from '../queues/validation-queue.js';
import { calculateRiskLevel } from '../schemas/risk-score.js';

/**
 * Rule Engine for Vulnerability Detection
 * Analyzes transactions for behavioral anomalies and security threats
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

/**
 * Risk Analysis Result
 * Combines findings with overall risk metrics for the transaction
 */
export interface RiskAnalysis {
  riskScore: number;        // 0-100 overall risk score
  riskLevel: string;        // SAFE, LOW, MEDIUM, HIGH, CRITICAL
  primaryFactor: string;    // Main risk contributor
  findings: Finding[];      // All findings from heuristics
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

// Constants for frequency detection thresholds
const FREQUENCY_WINDOW = 60000; // 1 minute
const BOT_THRESHOLD = 5; // > 5 txs per minute from same sender
const DDOS_THRESHOLD = 10; // > 10 txs per minute to same contract

// In-memory state for frequency detection (Botting/DDoS)
// Using LRU Cache to prevent memory leaks - max 10k entries with automatic cleanup
const frequencyMap = new LRUCache<string, number[]>({
  max: 10000,                    // Maximum 10k unique addresses tracked
  ttl: FREQUENCY_WINDOW * 2,     // Expire entries after 2 minutes
  updateAgeOnGet: true,          // Keep active addresses in cache
  updateAgeOnHas: true
});

// Periodic cleanup of stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, timestamps] of frequencyMap.entries()) {
    const recent = timestamps.filter((t: number) => now - t < FREQUENCY_WINDOW);
    if (recent.length === 0) {
      frequencyMap.delete(key);
      cleaned++;
    } else if (recent.length < timestamps.length) {
      frequencyMap.set(key, recent);
    }
  }

  logger.info(`Frequency map cleanup: ${cleaned} stale entries removed, ${frequencyMap.size} active entries`);
}, 5 * 60 * 1000);

/**
 * Analyze a transaction for vulnerabilities using behavioral heuristics
 * Returns RiskAnalysis with overall risk score and findings
 */
export async function analyzeTransaction(tx: Transaction): Promise<RiskAnalysis> {
  const findings: Finding[] = [];
  let maxRiskScore = 0;
  let primaryFactor = 'Normal transaction';

  // 1. Flash Loan Attack Pattern (Risk-based detection)
  const flashLoanRisk = detectFlashLoanAttack(tx);
  if (flashLoanRisk && flashLoanRisk.score >= 50) {
    const severity = flashLoanRisk.score >= 80 ? 'CRITICAL' :
                     flashLoanRisk.score >= 65 ? 'HIGH' : 'MEDIUM';

    findings.push({
      type: 'FLASH_LOAN_ATTACK',
      severity,
      contractAddress: tx.to,
      ruleConfidence: flashLoanRisk.confidence,
      description: `Potential Flash Loan Attack (Risk: ${flashLoanRisk.score}/100). Factors: ${flashLoanRisk.factors.join(', ')}`
    });

    // Update max risk score
    if (flashLoanRisk.score > maxRiskScore) {
      maxRiskScore = flashLoanRisk.score;
      primaryFactor = `Flash loan pattern: ${flashLoanRisk.factors[0]}`;
    }
  }

  // 2. High Frequency / Botting (Sender-based)
  if (detectHighFrequency(tx.from, 'sender')) {
    const botRiskScore = 45; // MEDIUM risk
    findings.push({
      type: 'HIGH_FREQUENCY_BOT',
      severity: 'MEDIUM',
      contractAddress: tx.to,
      ruleConfidence: 0.85,
      description: 'High frequency transaction pattern detected from sender (potential botting)'
    });

    if (botRiskScore > maxRiskScore) {
      maxRiskScore = botRiskScore;
      primaryFactor = 'High frequency botting pattern';
    }
  }

  // 3. DDoS / High Volume (Contract-based)
  if (detectHighFrequency(tx.to, 'contract')) {
    const ddosRiskScore = 70; // HIGH risk
    findings.push({
      type: 'DDOS_ATTACK',
      severity: 'HIGH',
      contractAddress: tx.to,
      ruleConfidence: 0.80,
      description: 'Unusual spike in transaction volume to this contract (potential DDoS)'
    });

    if (ddosRiskScore > maxRiskScore) {
      maxRiskScore = ddosRiskScore;
      primaryFactor = 'DDoS attack pattern';
    }
  }

  // 4. High Value Transfer
  if (detectHighValueTransfer(tx)) {
    const highValueRisk = 40; // MEDIUM risk
    findings.push({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'MEDIUM',
      contractAddress: tx.to,
      ruleConfidence: 0.75,
      description: `High value transfer detected: ${formatEther(BigInt(tx.value))} STT`
    });

    if (highValueRisk > maxRiskScore) {
      maxRiskScore = highValueRisk;
      primaryFactor = `High value transfer: ${formatEther(BigInt(tx.value))} STT`;
    }
  }

  // 5. Failed High Gas (Potential Exploit Attempt)
  if (detectFailedHighGas(tx)) {
    const failedGasRisk = 25; // LOW risk
    findings.push({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'LOW',
      contractAddress: tx.to,
      ruleConfidence: 0.60,
      description: 'Failed transaction with high gas usage (potential failed exploit)'
    });

    if (failedGasRisk > maxRiskScore) {
      maxRiskScore = failedGasRisk;
      primaryFactor = 'Failed high gas transaction';
    }
  }

  // 6. Spam / State Bloat (High Gas + Zero Value)
  if (detectSpamAttack(tx)) {
    const spamRiskScore = 65; // HIGH risk
    findings.push({
      type: 'SPAM_ATTACK',
      severity: 'HIGH',
      contractAddress: tx.to,
      ruleConfidence: 0.85,
      description: 'Potential Spam/State Bloat attack: Massive gas usage with zero value transfer'
    });

    if (spamRiskScore > maxRiskScore) {
      maxRiskScore = spamRiskScore;
      primaryFactor = 'Spam/State bloat attack';
    }
  }

  // 7. Governance Attack (Flash Loan Pattern + Governance Context)
  // Note: This is a heuristic overlap with Flash Loan, but we flag it if gas is EXTREMELY high
  if (detectGovernanceAttack(tx)) {
    const govRiskScore = 85; // CRITICAL risk
    findings.push({
      type: 'GOVERNANCE_ATTACK',
      severity: 'CRITICAL',
      contractAddress: tx.to,
      ruleConfidence: 0.80,
      description: 'Potential Governance Attack: Massive value movement with complex execution'
    });

    if (govRiskScore > maxRiskScore) {
      maxRiskScore = govRiskScore;
      primaryFactor = 'Governance attack pattern';
    }
  }

  // 8. Contract Deployment
  if (!tx.to) {
    findings.push({
      type: 'CONTRACT_DEPLOYMENT',
      severity: 'INFO',
      contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder
      ruleConfidence: 1.0,
      description: 'New contract deployment detected'
    });
    // Contract deployment is informational, doesn't increase risk score
  }

  // Calculate risk level from score
  const riskLevel = calculateRiskLevel(maxRiskScore);

  // NOTE: Findings are NOT stored here to prevent duplicates
  // They are stored in processTransaction() after analysis is complete

  return {
    riskScore: maxRiskScore,
    riskLevel,
    primaryFactor,
    findings
  };
}

/**
 * Risk Score Interface
 */
interface RiskScore {
  score: number;  // 0-100
  factors: string[];
  confidence: number;
}

/**
 * Heuristic 1: Flash Loan Attack with Risk Scoring
 * Uses multiple factors instead of hard thresholds to reduce false positives
 */
function detectFlashLoanAttack(tx: Transaction): RiskScore | null {
  const value = BigInt(tx.value);
  const gas = tx.gasUsed;

  let riskScore = 0;
  const factors: string[] = [];

  // Factor 1: High value (weighted, not binary)
  const valueThreshold = BigInt(10) * BigInt(1e18);  // 10 STT
  if (value > valueThreshold) {
    const multiplier = Number(value / valueThreshold);
    riskScore += Math.min(30, 10 + multiplier * 5);  // Max 30 points
    factors.push(`High value transfer: ${formatEther(value)} STT`);
  }

  // Factor 2: High gas usage (weighted)
  if (gas > 300000) {
    riskScore += Math.min(20, (gas - 300000) / 10000);  // Max 20 points
    factors.push(`High gas usage: ${gas}`);
  }

  // Factor 3: Very high gas (strong indicator)
  if (gas > 1000000) {
    riskScore += 25;
    factors.push('Extremely high gas usage (>1M)');
  }

  // Factor 4: Failed transaction with high value (suspicious)
  if (tx.status === 'failed' && value > BigInt(100) * BigInt(1e18)) {
    riskScore += 15;
    factors.push('Failed transaction with significant value');
  }

  // Only flag if risk score is significant (> 50)
  if (riskScore < 50) {
    return null;
  }

  return {
    score: Math.min(100, riskScore),
    factors,
    confidence: riskScore >= 70 ? 0.90 : 0.75
  };
}

/**
 * Heuristic 2 & 3: High Frequency Detection
 * Tracks timestamps for keys (sender or contract)
 */
function detectHighFrequency(key: string, type: 'sender' | 'contract'): boolean {
  if (!key) return false;

  const now = Date.now();
  const timestamps = frequencyMap.get(key) || [];

  // Filter out old timestamps
  const recent = timestamps.filter((t: number) => now - t < FREQUENCY_WINDOW);
  recent.push(now);

  frequencyMap.set(key, recent);

  const threshold = type === 'sender' ? BOT_THRESHOLD : DDOS_THRESHOLD;
  return recent.length > threshold;
}

/**
 * Heuristic 4: High Value Transfer
 * > 10 STT
 */
function detectHighValueTransfer(tx: Transaction): boolean {
  const value = BigInt(tx.value);
  const THRESHOLD_VALUE = BigInt(10) * BigInt(1e18); // 10 STT
  return value > THRESHOLD_VALUE;
}

/**
 * Heuristic 5: Failed High Gas
 * Status 'failed' AND Gas > 200,000
 */
function detectFailedHighGas(tx: Transaction): boolean {
  const THRESHOLD_GAS = 200000;
  return tx.status === 'failed' && tx.gasUsed > THRESHOLD_GAS;
}

/**
 * Heuristic 6: Spam / State Bloat
 * Gas > 1,000,000 AND Value == 0
 */
function detectSpamAttack(tx: Transaction): boolean {
  const value = BigInt(tx.value);
  const gas = tx.gasUsed;
  const THRESHOLD_GAS = 1000000;

  return gas > THRESHOLD_GAS && value === BigInt(0);
}

/**
 * Heuristic 7: Governance Attack
 * Value > 25 STT AND Gas > 500,000
 */
function detectGovernanceAttack(tx: Transaction): boolean {
  const value = BigInt(tx.value);
  const gas = tx.gasUsed;
  // WARNING: Lowered values for testing purposes
  const THRESHOLD_VALUE = BigInt(25) * BigInt(1e18); // 25 STT (Production: 10,000 STT)
  const THRESHOLD_GAS = 500000;

  return value > THRESHOLD_VALUE && gas > THRESHOLD_GAS;
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
        to: tx.to || '0x0000000000000000000000000000000000000000', // Handle deployment
        value: tx.value,
        gasUsed: tx.gasUsed,
        status: tx.status,
        timestamp: new Date(),
        contractAddress: tx.to || '0x0000000000000000000000000000000000000000'
      }
    });

    // Run rule engine - now returns RiskAnalysis
    const riskAnalysis = await analyzeTransaction(tx);
    const { findings, riskScore, riskLevel, primaryFactor } = riskAnalysis;

    // Store findings in database (before validation)
    for (const finding of findings) {
      const createdFinding = await prisma.finding.create({
        data: {
          contractAddress: finding.contractAddress,
          type: finding.type,
          severity: finding.severity,
          line: finding.line,
          functionName: finding.functionName,
          codeSnippet: finding.codeSnippet,
          ruleConfidence: finding.ruleConfidence,
          description: finding.description,
          validated: false
        }
      });

      // Queue finding for LLM validation with priority based on severity
      const priority = finding.severity === 'CRITICAL' ? 'high' :
                       finding.severity === 'HIGH' ? 'medium' : 'low';

      await queueValidation(createdFinding, priority);
    }

    // Emit transaction event to frontend with risk score
    io.emit('transaction', {
      hash: tx.hash,
      to: tx.to,
      gasUsed: tx.gasUsed,
      status: tx.status,
      findingsCount: findings.length,
      riskScore,
      riskLevel
    });

    // Emit findings to frontend for real-time updates
    if (findings.length > 0) {
      io.emit('new_findings', {
        contractAddress: tx.to,
        count: findings.length,
        riskScore,
        riskLevel,
        primaryFactor,
        findings: findings.map(f => ({
          type: f.type,
          severity: f.severity,
          description: f.description
        }))
      });
    }

    return riskAnalysis;
  } catch (error) {
    console.error('Error processing transaction:', error);
    return {
      riskScore: 0,
      riskLevel: 'SAFE',
      primaryFactor: 'Error during analysis',
      findings: []
    };
  }
}
