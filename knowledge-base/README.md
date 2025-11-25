# ChainGuard Vulnerability Knowledge Base

## Overview

This knowledge base contains comprehensive information about smart contract vulnerabilities for use with ChainGuard's LLM-based validation system. Each vulnerability type includes patterns, real-world examples, detection methods, and validation criteria.

## Knowledge Base Structure

```
knowledge-base/
├── README.md (this file)
├── reentrancy.md
├── access_control.md
├── unchecked_calls.md
└── gas_anomalies.md
```

## Vulnerability Types Covered

### 1. Reentrancy (reentrancy.md)
**Severity**: CRITICAL  
**Description**: External calls before state updates allowing recursive exploitation  
**Famous Examples**: The DAO Hack ($60M), Cream Finance ($130M)  
**Key Patterns**:
- External call before state update
- Missing ReentrancyGuard
- Low-level calls (`.call`, `.delegatecall`)

### 2. Access Control (access_control.md)
**Severity**: CRITICAL  
**Description**: Missing authorization checks on sensitive functions  
**Famous Examples**: Parity Wallet ($150M), Poly Network ($611M)  
**Key Patterns**:
- Sensitive functions without modifiers
- Missing `onlyOwner` / `onlyRole`
- Unprotected `selfdestruct`

### 3. Unchecked External Calls (unchecked_calls.md)
**Severity**: HIGH  
**Description**: Low-level calls without success verification  
**Famous Examples**: King of the Ether, Various DeFi protocols  
**Key Patterns**:
- `.call()` without checking return value
- Silent failures in payment distribution
- Unchecked `delegatecall` in proxies

### 4. Gas Anomalies (gas_anomalies.md)
**Severity**: MEDIUM-HIGH  
**Description**: Unusual gas consumption indicating bugs or DoS attacks  
**Famous Examples**: GovernMental, CryptoKitties congestion  
**Key Patterns**:
- Unbounded loops
- Storage bloat
- >50% deviation from baseline

## Usage with RAG System

### For N8N Integration

**Step 1: Load Knowledge Base**
```javascript
// In N8N workflow
const knowledgeBase = {
  reentrancy: await loadMarkdown('knowledge-base/reentrancy.md'),
  accessControl: await loadMarkdown('knowledge-base/access_control.md'),
  uncheckedCalls: await loadMarkdown('knowledge-base/unchecked_calls.md'),
  gasAnomalies: await loadMarkdown('knowledge-base/gas_anomalies.md')
};
```

**Step 2: Create Embeddings**
```javascript
// Split each document into chunks
const chunks = splitIntoChunks(knowledgeBase, {
  chunkSize: 1000,
  overlap: 200
});

// Generate embeddings
const embeddings = await generateEmbeddings(chunks);

// Store in vector database
await vectorDB.upsert(embeddings);
```

**Step 3: Query for Validation**
```javascript
// When rule engine detects potential vulnerability
const finding = {
  type: 'REENTRANCY',
  code: '...',
  function: 'withdraw',
  line: 145
};

// Retrieve relevant context
const context = await vectorDB.search(
  `${finding.type} vulnerability in ${finding.function}`,
  topK: 5
);

// Build prompt with context
const prompt = buildValidationPrompt(finding, context);

// Call LLM
const validation = await callClaude(prompt);
```

## Validation Workflow

```
┌─────────────────────────────────────────────────┐
│  ChainGuard Rule Engine                         │
│  Detects potential vulnerability                │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  N8N Webhook Trigger                            │
│  Receives finding + code context                │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Vector Database Query                          │
│  Retrieves relevant knowledge (top 5 chunks)    │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Build Validation Prompt                        │
│  Finding + Code + Knowledge Base Context        │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Claude API Call                                │
│  LLM analyzes with expert knowledge             │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Parse Response                                 │
│  Extract: valid, confidence, severity, reason   │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Return to ChainGuard                           │
│  Update finding with LLM validation             │
└─────────────────────────────────────────────────┘
```

## Prompt Template Structure

Each knowledge base file includes LLM validation prompts with this structure:

```
You are a smart contract security auditor specializing in [VULNERABILITY_TYPE].

FINDING:
Type: [TYPE]
Function: [FUNCTION_NAME]
Line: [LINE_NUMBER]

CODE SNIPPET:
[CODE]

ANALYSIS:
[RULE_ENGINE_ANALYSIS]

CONTEXT:
[ADDITIONAL_CONTEXT]

QUESTION:
Is this a true [VULNERABILITY_TYPE] vulnerability?

Check for:
1. [CHECK_1]
2. [CHECK_2]
3. [CHECK_3]

Respond in JSON:
{
  "valid": true/false,
  "confidence": 0-100,
  "severity": "CRITICAL/HIGH/MEDIUM/LOW/FALSE_POSITIVE",
  "reason": "one sentence explanation",
  "recommendation": "specific fix"
}
```

## Response Format

All LLM responses follow this JSON schema:

```typescript
interface ValidationResponse {
  valid: boolean;              // Is this a true vulnerability?
  confidence: number;          // 0-100
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'FALSE_POSITIVE';
  reason: string;              // One sentence explanation
  recommendation: string;      // Specific fix or action
  additionalContext?: string;  // Optional extra details
}
```

## Confidence Scoring Guidelines

**90-100%**: Clear vulnerability or clear false positive
- Textbook example
- Obvious pattern match
- No ambiguity

**70-89%**: High confidence with minor uncertainty
- Pattern matches but has some protection
- Context suggests vulnerability
- Small edge cases possible

**50-69%**: Moderate confidence
- Conflicting signals
- Requires deeper analysis
- Input-dependent behavior

**Below 50%**: Low confidence
- Insufficient context
- Ambiguous code
- Requires manual review

## Severity Mapping

### CRITICAL
- Direct fund loss possible
- Contract destruction risk
- Immediate exploitation likely
- **Action**: Alert user immediately, recommend pause

### HIGH
- Significant state manipulation
- Privilege escalation
- Likely exploitation with effort
- **Action**: Alert user, recommend fix ASAP

### MEDIUM
- Theoretical vulnerability
- Requires specific conditions
- Limited impact
- **Action**: Notify user, suggest optimization

### LOW
- Edge case vulnerability
- Minimal impact
- Unlikely exploitation
- **Action**: Log for review

### FALSE_POSITIVE
- Not a vulnerability
- Properly protected
- Rule engine misidentified
- **Action**: Dismiss, update rules

## Integration Examples

### Example 1: Reentrancy Validation

**Input**:
```json
{
  "finding": {
    "type": "REENTRANCY",
    "function": "withdraw",
    "line": 145,
    "code_snippet": "function withdraw(uint256 amount) external {\n    require(balances[msg.sender] >= amount);\n    (bool success, ) = msg.sender.call{value: amount}(\"\");\n    require(success);\n    balances[msg.sender] -= amount;\n}",
    "rule_confidence": 0.9
  },
  "contract_context": "Full contract source...",
  "similar_cases": [...]
}
```

**Output**:
```json
{
  "valid": true,
  "confidence": 95,
  "severity": "CRITICAL",
  "reason": "External call before state update with no reentrancy guard allows recursive calls to drain funds",
  "recommendation": "Move state update before external call or add nonReentrant modifier"
}
```

### Example 2: Access Control Validation

**Input**:
```json
{
  "finding": {
    "type": "ACCESS_CONTROL",
    "function": "mint",
    "line": 78,
    "code_snippet": "function mint(address to, uint256 amount) external onlyOwner {\n    _mint(to, amount);\n}",
    "rule_confidence": 0.85
  }
}
```

**Output**:
```json
{
  "valid": false,
  "confidence": 99,
  "severity": "FALSE_POSITIVE",
  "reason": "Function has onlyOwner modifier providing proper access control",
  "recommendation": "No action needed - properly protected"
}
```

## Updating the Knowledge Base

### Adding New Vulnerability Types

1. Create new markdown file: `knowledge-base/[vulnerability_type].md`
2. Follow existing structure:
   - Definition
   - Vulnerability Pattern
   - Detection Patterns
   - Real-World Examples
   - Secure Patterns
   - Validation Criteria
   - LLM Validation Prompts
   - References

3. Update this README with new entry
4. Regenerate embeddings
5. Test with sample cases

### Improving Existing Content

- Add new real-world examples as they occur
- Update secure patterns with latest best practices
- Refine validation criteria based on false positives/negatives
- Enhance LLM prompts for better accuracy

## Performance Metrics

Track these metrics to improve the system:

- **Accuracy**: % of correct validations
- **False Positive Rate**: % of false alarms
- **False Negative Rate**: % of missed vulnerabilities
- **Confidence Calibration**: Actual accuracy vs reported confidence
- **Response Time**: Average LLM validation time

## Best Practices

1. **Always provide code context**: Full function or surrounding code
2. **Include contract metadata**: Solidity version, imports, inheritance
3. **Batch similar findings**: Validate related issues together
4. **Cache results**: Don't re-validate identical code
5. **Update baselines**: Continuously improve with new examples
6. **Human review**: Always have security experts review CRITICAL findings

## Troubleshooting

### Low Confidence Scores
- Provide more code context
- Include full contract source
- Add similar historical cases

### High False Positive Rate
- Refine detection rules
- Update knowledge base with edge cases
- Improve prompt engineering

### Slow Validation
- Optimize vector search (reduce topK)
- Cache common patterns
- Use faster embedding model

## References

- [Smart Contract Weakness Classification (SWC)](https://swcregistry.io/)
- [Consensys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OpenZeppelin Security](https://docs.openzeppelin.com/contracts/4.x/api/security)
- [Ethereum Security Tools](https://ethereum.org/en/developers/docs/security/)

## License

This knowledge base is part of the ChainGuard project and is provided for educational and security research purposes.
