# Blockchain Security Knowledge Base (RAG-Optimized)

## Overview

This knowledge base contains comprehensive information about **behavioral attack patterns** for use with our LLM-based validation system via N8N and RAG (Retrieval-Augmented Generation).

**IMPORTANT**: This knowledge base focuses on **transaction-level behavioral analysis**, NOT static code analysis. We detect attacks by analyzing transaction patterns, gas usage, value transfers, and other runtime behaviors.

## What We Detect (Behavioral Heuristics)

Our system detects **8 behavioral patterns** through real-time transaction analysis:

1. ✅ **Flash Loan Attacks** - High value + high gas pattern
2. ✅ **Bot Activity** - High-frequency transactions (>5 tx/min)
3. ✅ **DDoS Attacks** - Contract flooding (>10 tx/min to same contract)
4. ✅ **Spam/State Bloat** - High gas + zero value transactions
5. ✅ **Governance Attacks** - Voting manipulation patterns
6. ✅ **High-Value Transfers** - Large fund movements
7. ✅ **Failed High-Gas Transactions** - Suspicious failed attempts
8. ✅ **Suspicious Patterns** - Anomalous behavior requiring investigation

## What We DON'T Detect

❌ **Static Code Vulnerabilities**: Reentrancy, access control issues, unchecked calls (requires bytecode/AST analysis)
❌ **Pre-Deployment Analysis**: We analyze live transactions, not contract code before deployment
❌ **Logic Bugs**: Business logic errors in smart contract code

> **Note**: Static code analysis capabilities may be added in future versions. See `knowledge-base-backup/` for documentation on code-level vulnerabilities.

## Knowledge Base Structure

```
knowledge-base/
├── README.md (this file)
├── flash_loan_attacks.md      # Flash loan detection and validation
├── botting_attacks.md          # High-frequency bot pattern detection
├── ddos_attacks.md             # DDoS and block stuffing attacks
├── spam_attacks.md             # State bloat and spam transactions
├── governance_attacks.md       # Voting manipulation and treasury attacks
└── suspicious_patterns.md      # Catch-all anomalous behavior
```

## Behavioral Patterns Covered

### 1. Flash Loan Attacks (flash_loan_attacks.md)
**Severity**: CRITICAL to HIGH
**Detection**: Risk scoring (50-100 points)
**Key Signals**:
- High value transfer (>1000 STT)
- High gas usage (>300k, critical if >1M)
- Single transaction execution
- Famous Examples: Cream Finance ($130M), Harvest Finance ($34M)

**Risk Scoring**:
```
High value (>1000 STT):      10-30 points
High gas (>300k):            up to 20 points
Extremely high gas (>1M):    25 points
Failed high value (>100):    15 points

Score 50-64:  MEDIUM
Score 65-79:  HIGH
Score 80-100: CRITICAL
```

### 2. Botting Attacks (botting_attacks.md)
**Severity**: MEDIUM to HIGH
**Detection**: Frequency threshold (>5 transactions/minute)
**Key Signals**:
- Rapid transaction submission
- Automated patterns (MEV, sandwich attacks)
- Front-running behavior
- Famous Examples: MEV bots ($600M+ extracted annually)

**Types**:
- MEV Bots (arbitrage, sandwich attacks)
- Spam Bots (state bloat)
- Gaming Bots (exploit automation)

### 3. DDoS Attacks (ddos_attacks.md)
**Severity**: HIGH
**Detection**: >10 transactions/minute to same contract
**Key Signals**:
- Contract flooding
- Block stuffing (fill blocks to prevent others)
- Unbounded loop triggering
- Famous Examples: Fomo3D ($3M via block stuffing), GovernMental lockup

**Distinction from Bot**:
- DDoS: Many txs to SAME TARGET (attack specific contract)
- Bot: Many txs from SAME SENDER (automated trading/operations)

### 4. Spam Attacks (spam_attacks.md)
**Severity**: HIGH
**Detection**: Gas >1,000,000 AND Value == 0
**Key Signals**:
- Massive gas consumption without value transfer
- Storage bloat (excessive SSTORE operations)
- Event log spam
- Famous Examples: ENS spam (2017), ERC-20 airdrop spam

**Why 1M Gas is Significant**:
```
Simple transfer:    21,000 gas
Token transfer:     50,000 gas
DeFi swap:         300,000 gas
Flash loan:        500k-2M gas
SPAM ATTACK:       1M-10M+ gas with ZERO value!
```

### 5. Governance Attacks (governance_attacks.md)
**Severity**: CRITICAL
**Detection**: Flash loan + voting power spike pattern
**Key Signals**:
- Temporary massive voting power (flash loan funded)
- Proposal execution in same block as vote
- Treasury drain to proposer
- Famous Examples: Beanstalk ($182M), Build Finance ($470k)

**Attack Pattern**:
```
1. Flash loan massive funds
2. Swap to governance tokens (67% voting power)
3. Create + Vote + Execute malicious proposal
4. Drain treasury
5. Return flash loan
Duration: Seconds to minutes
```

### 6. Suspicious Patterns (suspicious_patterns.md)
**Severity**: LOW to HIGH
**Detection**: Anomaly scoring (multiple weak indicators)
**Key Signals**:
- New address (<1 day) from mixer
- High transaction failure rate (>50%)
- Unusual function calls from EOA
- Progressive value escalation (test → exploit)

**Anomaly Scoring**:
```javascript
suspicionScore = 0;
if (addressAge < 1 day) += 15;
if (fundedFromMixer) += 25;
if (failureRate > 50%) += 20;
if (highValueFromNew) += 20;
if (unusualFunction) += 15;

Score 70+:  HIGH (likely attack preparation)
Score 50-69: MEDIUM (worth monitoring)
Score 30-49: LOW (log for analysis)
```

## RAG System Integration

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Backend Rule Engine (monitor.ts)               │
│  Analyzes transactions → Generates findings     │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Validation Queue (queues/validation.ts)        │
│  Priority-based LLM validation queue            │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  N8N Webhook (llm/validator.ts)                 │
│  Sends finding + context to N8N workflow        │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Vector Database Query (in N8N)                 │
│  RAG: Search knowledge base for relevant docs   │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Claude API (in N8N)                            │
│  LLM validates finding with RAG context         │
└─────────────────┬───────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────┐
│  Response to Backend                            │
│  Update finding with validation result          │
└─────────────────────────────────────────────────┘
```

### N8N Workflow Setup

**Step 1: Create Vector Embeddings**
```javascript
// In N8N: Load all knowledge base markdown files
const knowledgeBase = {
  flashLoan: await loadMarkdown('knowledge-base/flash_loan_attacks.md'),
  botting: await loadMarkdown('knowledge-base/botting_attacks.md'),
  ddos: await loadMarkdown('knowledge-base/ddos_attacks.md'),
  spam: await loadMarkdown('knowledge-base/spam_attacks.md'),
  governance: await loadMarkdown('knowledge-base/governance_attacks.md'),
  suspicious: await loadMarkdown('knowledge-base/suspicious_patterns.md')
};

// Split into chunks optimized for RAG
const chunks = splitIntoChunks(knowledgeBase, {
  chunkSize: 1000,    // ~250 tokens per chunk
  overlap: 200        // Preserve context across chunks
});

// Generate embeddings (use OpenAI text-embedding-3-small or similar)
const embeddings = await generateEmbeddings(chunks);

// Store in vector database (Pinecone, Weaviate, or Qdrant)
await vectorDB.upsert(embeddings);
```

**Step 2: RAG Query on Webhook Trigger**
```javascript
// N8N receives finding from backend
const finding = {
  type: 'FLASH_LOAN_ATTACK',
  riskScore: 75,
  transaction: { hash: '0x...', value: '5000', gasUsed: 850000 },
  factors: ['High value: 5000 STT', 'High gas: 850k']
};

// Query vector DB for relevant context (RAG)
const context = await vectorDB.search(
  query: `${finding.type} transaction analysis with ${finding.factors.join(', ')}`,
  topK: 5,        // Top 5 most relevant chunks
  minScore: 0.7   // Similarity threshold
);

// context returns relevant sections from knowledge base
```

**Step 3: Build Validation Prompt with RAG Context**
```javascript
const prompt = `
You are a blockchain security expert analyzing behavioral attack patterns.

FINDING:
${JSON.stringify(finding, null, 2)}

RELEVANT KNOWLEDGE BASE CONTEXT:
${context.map((chunk, i) => `[${i+1}] ${chunk.content}`).join('\n\n')}

QUESTION:
Is this a valid ${finding.type}? Analyze the transaction pattern against known attack signatures.

Respond in JSON:
{
  "valid": true/false,
  "confidence": 0-100,
  "severity": "CRITICAL/HIGH/MEDIUM/LOW/FALSE_POSITIVE",
  "reason": "one sentence explanation",
  "recommendation": "specific action to take"
}
`;

// Send to Claude
const validation = await claudeAPI.complete(prompt);
```

**Step 4: Return to Backend**
```javascript
// N8N webhook responds to backend
return {
  findingId: finding.id,
  validation: {
    valid: validation.valid,
    confidence: validation.confidence,
    severity: validation.severity,
    reason: validation.reason,
    recommendation: validation.recommendation
  }
};

// Backend updates finding in database
await prisma.finding.update({
  where: { id: finding.id },
  data: {
    llmValidated: true,
    llmConfidence: validation.confidence,
    llmSeverity: validation.severity,
    llmReasoning: validation.reason
  }
});
```

## LLM Response Format

All LLM validations follow this JSON schema:

```typescript
interface ValidationResponse {
  valid: boolean;              // Is this a true positive?
  confidence: number;          // 0-100
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'FALSE_POSITIVE';
  reason: string;              // One sentence explanation
  recommendation: string;      // Specific action (pause contract, monitor, etc.)
}
```

### Example Responses

**Valid Flash Loan Attack:**
```json
{
  "valid": true,
  "confidence": 85,
  "severity": "HIGH",
  "reason": "Transaction shows classic flash loan pattern with high value transfer (5000 STT) and complex execution (850k gas), typical of DeFi manipulation attacks",
  "recommendation": "Monitor for repeated patterns from this address. Consider pausing contract if attacks continue. Review price oracle integrity."
}
```

**False Positive (Legitimate DeFi):**
```json
{
  "valid": false,
  "confidence": 90,
  "severity": "FALSE_POSITIVE",
  "reason": "High gas usage is from legitimate liquidity provision to known DEX. Transaction follows expected pattern for large deposits.",
  "recommendation": "No action needed. This is normal high-value DeFi activity."
}
```

**Uncertain (Needs Monitoring):**
```json
{
  "valid": true,
  "confidence": 55,
  "severity": "MEDIUM",
  "reason": "Pattern is unusual but not definitively malicious. Could be advanced user testing or early-stage attack reconnaissance.",
  "recommendation": "Continue monitoring. Set alert if address increases frequency or achieves successful execution. Reassess in 24 hours."
}
```

## Confidence Scoring Guidelines

**90-100%**: Clear determination
- Textbook attack pattern or clear legitimate activity
- Multiple strong indicators align
- No ambiguity in classification

**70-89%**: High confidence
- Pattern matches known signatures
- Context supports classification
- Minor edge cases possible

**50-69%**: Moderate confidence
- Mixed signals
- Could go either way
- Needs monitoring or more data

**Below 50%**: Low confidence
- Insufficient context
- Ambiguous pattern
- Recommend manual review

## Severity Mapping

### CRITICAL
- **Impact**: Direct fund loss, protocol compromise
- **Examples**: Successful flash loan drain, governance takeover
- **Action**: IMMEDIATE alert, recommend contract pause, notify team

### HIGH
- **Impact**: Significant risk, likely exploitation
- **Examples**: High-value suspicious transfers, DDoS attacks
- **Action**: Alert user, close monitoring, prepare incident response

### MEDIUM
- **Impact**: Moderate risk, requires investigation
- **Examples**: Bot activity, spam transactions, suspicious patterns
- **Action**: Monitor closely, log for analysis, track patterns

### LOW
- **Impact**: Minor concern, informational
- **Examples**: Edge case anomalies, low-confidence suspicious activity
- **Action**: Log for future reference, no immediate action

### FALSE_POSITIVE
- **Impact**: No risk, incorrectly flagged
- **Examples**: Legitimate high-value DeFi, authorized batch operations
- **Action**: Dismiss alert, consider tuning detection rules

## Knowledge Base Optimization

Each markdown file is structured for optimal RAG retrieval:

### Document Structure
1. **What is [Attack Type]?** - Clear definition for semantic matching
2. **Behavioral Characteristics** - Detection thresholds and signals
3. **Real-World Examples** - Named attacks with dollar amounts (aids recognition)
4. **Detection Logic** - Specific patterns and code examples
5. **False Positive Scenarios** - How to distinguish legitimate activity
6. **LLM Validation Context** - Example prompts and expected responses
7. **Prevention & Mitigation** - Actionable recommendations
8. **Summary for RAG** - Key takeaways optimized for retrieval

### Chunking Strategy
- **Chunk Size**: 1000 characters (~250 tokens)
- **Overlap**: 200 characters (preserves context)
- **Sections**: Each major section should fit in 1-2 chunks
- **Keywords**: Attack names, dollar amounts, specific patterns

## Performance Metrics

Track these to improve the system:

- **Accuracy**: % of correct validations (target: >85%)
- **False Positive Rate**: % of incorrect alerts (target: <15%)
- **False Negative Rate**: % of missed attacks (target: <5%)
- **Confidence Calibration**: Correlation between confidence and accuracy
- **Response Time**: LLM validation latency (target: <3 seconds)
- **RAG Relevance**: Are retrieved chunks actually useful?

## Best Practices

### For Backend Integration
1. **Always send transaction context**: Full tx data, not just hash
2. **Include historical patterns**: Has this address done this before?
3. **Batch similar findings**: Validate related patterns together
4. **Cache results**: Don't re-validate identical patterns
5. **Rate limit**: Don't overwhelm LLM API (use validation queue)

### For Knowledge Base Updates
1. **Add new attack examples**: Update as new exploits occur
2. **Refine thresholds**: Adjust based on false positive/negative rates
3. **Document edge cases**: Add scenarios that caused misclassification
4. **Update RAG chunks**: Regenerate embeddings after significant updates

### For N8N Workflow
1. **Optimize topK**: Start with 5 chunks, adjust based on relevance
2. **Monitor token usage**: Large contexts = expensive API calls
3. **Implement fallbacks**: What if vector DB is down?
4. **Log everything**: Track which chunks were retrieved for each validation

## Troubleshooting

### High False Positive Rate
- **Problem**: Too many legitimate activities flagged
- **Solutions**:
  - Lower detection thresholds (e.g., bot >10 tx/min instead of >5)
  - Add more false positive examples to knowledge base
  - Improve RAG chunking to include distinction criteria

### Low Confidence Scores
- **Problem**: LLM frequently returns <70% confidence
- **Solutions**:
  - Provide more transaction context (full calldata, contract info)
  - Add historical address behavior to prompt
  - Include similar past findings in context

### Slow Validation
- **Problem**: LLM validation takes >5 seconds
- **Solutions**:
  - Reduce topK (5 → 3 chunks)
  - Use faster embedding model
  - Implement caching for common patterns
  - Process validation queue in parallel batches

### RAG Retrieves Irrelevant Chunks
- **Problem**: Vector search returns unrelated content
- **Solutions**:
  - Improve chunk metadata (add tags: attack_type, severity)
  - Use hybrid search (keyword + semantic)
  - Adjust similarity threshold (minScore)
  - Regenerate embeddings with better model

## Updating the Knowledge Base

### Adding New Attack Patterns

1. Create new file: `knowledge-base/new_attack.md`
2. Follow template structure:
   ```markdown
   # [Attack Name] - Knowledge Base

   ## What is [Attack]?
   [Clear definition]

   ## Behavioral Characteristics
   [Detection thresholds]

   ## Real-World Examples
   [Named attacks with amounts]

   ## Detection Logic
   [Specific patterns]

   ## False Positive Scenarios
   [How to distinguish]

   ## LLM Validation Context
   [Example prompts/responses]

   ## Summary for RAG
   [Key takeaways]
   ```

3. Update this README
4. Regenerate embeddings in N8N
5. Test with sample transactions

### Improving Existing Content

- **Add new examples**: As attacks occur in the wild
- **Refine thresholds**: Based on real-world performance
- **Document edge cases**: Add scenarios that caused issues
- **Update recommendations**: Best practices evolve

## References

- [Smart Contract Weakness Classification (SWC)](https://swcregistry.io/)
- [Consensys Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Rekt News](https://rekt.news/) - Real-world attack analysis
- [Blockchain Threat Intelligence](https://github.com/openblocksec/blockchain-threat-intelligence)

## License

This knowledge base is part of the ChainGuard project and is provided for educational and security research purposes.

---

**Version**: 1.0.0
**Last Updated**: 2024
**Focus**: Behavioral transaction analysis (not static code analysis)
