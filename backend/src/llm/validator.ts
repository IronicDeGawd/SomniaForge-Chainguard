import { Finding } from '../rules/engine.js';
import prisma from '../db/prisma.js';
import { io } from '../server.js';

const WEBHOOK_URL = process.env.LLM_WEBHOOK_URL || 'https://n8n.ironyaditya.xyz/webhook/939ffefe-c76c-4850-9d89-266588d24a9a';

/**
 * Validate a finding using the LLM validator webhook
 */
export async function validateFinding(finding: Finding) {
  try {
    console.log(`Validating finding: ${finding.type} for ${finding.contractAddress}`);
    
    const response = await fetch(WEBHOOK_URL, {
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
        contract_context: finding.description,
        similar_cases: {},
        session_id: `session-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      console.error(`LLM validation failed: ${response.status}`);
      return null;
    }
    
    const validation = await response.json() as {
      valid: boolean;
      confidence: number;
      severity: string;
      reason: string;
      recommendation: string;
      additionalContext?: string;
    };
    
    console.log(`LLM validation result: ${validation.valid ? 'VALID' : 'FALSE POSITIVE'} (confidence: ${validation.confidence}%)`);
    
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
      
      console.log(`Alert created: ${alert.id}`);
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
    console.error('LLM validation error:', error);
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
