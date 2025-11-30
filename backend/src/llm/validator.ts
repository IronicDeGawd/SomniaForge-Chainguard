import { Finding } from '../rules/engine.js';
import prisma from '../db/prisma.js';
import { io } from '../server.js';

const WEBHOOK_URL = process.env.LLM_WEBHOOK_URL || 'https://n8n.ironyaditya.xyz/webhook/939ffefe-c76c-4850-9d89-266588d24a9a';

/**
 * Get descriptive context for LLM based on finding type
 */
function getContextForType(type: string): string {
  switch (type) {
    case 'FLASH_LOAN_ATTACK':
      return 'This transaction involves a high value transfer combined with high gas usage, which is a common pattern in flash loan attacks where an attacker borrows a large amount, executes complex logic, and repays it in the same transaction.';
    case 'HIGH_FREQUENCY_BOT':
      return 'The sender has executed a high number of transactions in a very short period. This behavior is typical of bots or automated scripts, potentially indicating a Sybil attack or market manipulation.';
    case 'DDOS_ATTACK':
      return 'The contract is receiving an unusually high volume of transactions in a short period. This could indicate a Denial of Service (DDoS) attack attempting to clog the network or the contract.';
    case 'GOVERNANCE_ATTACK':
      return 'This transaction involves a massive value transfer and high gas usage, potentially indicating a flash loan being used to manipulate a governance vote or proposal.';
    case 'SPAM_ATTACK':
      return 'The transaction consumes a large amount of gas but transfers zero value. This is often a sign of a spam attack or "state bloat" attack intended to waste network resources.';
    case 'SUSPICIOUS_ACTIVITY':
      return 'This transaction exhibits unusual characteristics such as high value transfer or high gas usage without a clear purpose.';
    default:
      return 'Potential security vulnerability detected based on behavioral heuristics.';
  }
}

/**
 * Validate a finding using the LLM validator webhook
 */
import { logger } from '../utils/logger.js';

/**
 * Validate a finding using the LLM validator webhook
 */
export async function validateFinding(finding: Finding) {
  try {
    logger.info(`Validating finding: ${finding.type} for ${finding.contractAddress}`);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    let response;
    try {
      response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding: {
            type: finding.type,
            function: finding.functionName || 'unknown',
            line: finding.line || 0,
            code_snippet: finding.codeSnippet || '',
            rule_confidence: finding.ruleConfidence
          },
          contract_context: `${finding.description}. ${getContextForType(finding.type)}`,
          similar_cases: {},
          session_id: `session-${Date.now()}`
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.error(`LLM validation failed: ${response.status}`);
        return null;
      }

    } catch (fetchError: any) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        logger.error(`LLM validation timeout after 120s for ${finding.contractAddress}`);
      }
      throw fetchError;
    }

    const validation = await response.json() as {
      valid: boolean;
      confidence: number;
      severity: string;
      reason: string;
      recommendation: string;
      additionalContext?: string;
    };
    
    logger.info(`LLM validation result: ${validation.valid ? 'VALID' : 'FALSE POSITIVE'} (confidence: ${validation.confidence}%)`);
    
    // Create alert if valid
    if (validation.valid) {
      const alert = await prisma.alert.create({
        data: {
          severity: validation.severity,
          type: finding.type,
          contractAddress: finding.contractAddress,
          description: validation.reason,
          recommendation: validation.recommendation,
          llmValid: true,
          llmConfidence: validation.confidence,
          llmReason: validation.reason,
          llmContext: validation.additionalContext || ''
        }
      });
      
      // Emit alert to frontend via WebSocket
      io.emit('alert', {
        id: alert.id,
        severity: alert.severity,
        type: alert.type,
        contractAddress: alert.contractAddress,
        description: alert.description,
        confidence: alert.llmConfidence,
        timestamp: alert.createdAt
      });
      
      logger.info(`Alert created: ${alert.id}`);
    }
    
    // Mark finding as validated
    await prisma.finding.updateMany({
      where: {
        contractAddress: finding.contractAddress,
        type: finding.type,
        validated: false
      },
      data: { validated: true }
    });
    
    return validation;
  } catch (error) {
    logger.error('LLM validation error:', error);
    return null;
  }
}

/**
 * Batch validate multiple findings
 */
export async function validateFindings(findings: Finding[]) {
  const results = [];
  
  for (const finding of findings) {
    const result = await validateFinding(finding);
    if (result) {
      results.push(result);
    }
    
    // Add small delay to avoid overwhelming the LLM service
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
