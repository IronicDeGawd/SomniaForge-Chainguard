# Flash Loan Attack Pattern - Knowledge Base

## What is a Flash Loan Attack?

A flash loan attack is an exploit where an attacker borrows a massive amount of cryptocurrency without collateral, executes complex malicious operations, and repays the loan within a single transaction.

## Behavioral Characteristics

### Transaction Patterns
- **High Value Transfer**: Typically >1000 STT (or equivalent)
- **High Gas Usage**: Complex operations require >300,000 gas
- **Extremely High Gas**: Critical attacks often use >1,000,000 gas
- **Single Transaction**: All operations occur atomically

### Risk Scoring Factors

| Factor | Points | Threshold | Indicator |
|--------|--------|-----------|-----------|
| High value transfer | 10-30 | >10 STT | Borrowed amount |
| High gas usage | up to 20 | >300k gas | Complex logic |
| Extremely high gas | 25 | >1M gas | Multiple DeFi interactions |
| Failed high value | 15 | >10 STT failed | Failed exploit attempt |

**Risk Score Calculation:**
- Score 50-64 = MEDIUM severity
- Score 65-79 = HIGH severity
- Score 80-100 = CRITICAL severity

## Real-World Examples

### Cream Finance (2021) - $130M Loss
**Pattern:**
- Borrowed 500M USDC via flash loan
- Price manipulation through repeated borrows
- Gas used: ~2.5M
- Value transferred: >$100M

**Detection Signature:**
```
Risk Score: 85/100
- High value: 30 points (100M+ USDC)
- Extremely high gas: 25 points (2.5M gas)
- Multiple reentrancy: 20 points
- Price manipulation: 10 points
```

### Harvest Finance (2020) - $34M Loss
**Pattern:**
- Flash loan from Uniswap
- Arbitrage manipulation
- Gas used: ~1.2M
- Multiple swaps in single transaction

**Detection Signature:**
```
Risk Score: 75/100
- High value: 25 points (34M)
- High gas: 20 points (1.2M)
- Rapid execution: 15 points
- Multiple protocols: 15 points
```

## Detection Logic

### When to Alert

**CRITICAL (Score ≥80):**
- Massive value movement (>10,000 STT)
- Extremely high gas (>1M)
- Multiple complex operations
- Confidence: 90%

**HIGH (Score 65-79):**
- Large value (>5,000 STT)
- High gas (>500k)
- Complex execution
- Confidence: 85%

**MEDIUM (Score 50-64):**
- Moderate value (>1,000 STT)
- Elevated gas (>300k)
- Unusual pattern
- Confidence: 75%

### False Positive Scenarios

**Legitimate High-Value Operations:**
- DEX liquidity provision (predictable gas)
- Large token swaps (linear gas usage)
- Bridge operations (expected patterns)
- Yield farming deposits (known contracts)

**How to Distinguish:**
- Flash loans: Erratic gas patterns, multiple protocols
- Legitimate: Predictable gas, single protocol
- Flash loans: Borrow→Manipulate→Repay pattern
- Legitimate: Single directional flow

## LLM Validation Context

### What to Send to LLM

```json
{
  "finding_type": "FLASH_LOAN_ATTACK",
  "risk_score": 75,
  "factors": [
    "High value transfer: 5000 STT",
    "High gas usage: 850000",
    "Multiple protocol interactions"
  ],
  "transaction": {
    "hash": "0x...",
    "value": "5000000000000000000000",
    "gas_used": 850000,
    "status": "success",
    "from": "0x...",
    "to": "0x..."
  }
}
```

### Expected LLM Response

**Valid Attack:**
```json
{
  "valid": true,
  "confidence": 85,
  "severity": "HIGH",
  "reason": "Transaction shows classic flash loan pattern with high value transfer (5000 STT) and complex execution (850k gas), typical of DeFi manipulation attacks",
  "recommendation": "Monitor for repeated patterns from this address. Consider pausing contract if attacks continue. Review price oracle integrity."
}
```

**False Positive:**
```json
{
  "valid": false,
  "confidence": 90,
  "severity": "FALSE_POSITIVE",
  "reason": "High gas usage is from legitimate liquidity provision to known DEX. Transaction follows expected pattern for large deposits.",
  "recommendation": "No action needed. This is normal high-value DeFi activity."
}
```

## Prevention Recommendations

### Contract-Level Protections
1. **Flash Loan Detection**: Check `balance_before == balance_after`
2. **Rate Limiting**: Limit large operations per block
3. **Oracle Delays**: Use time-weighted average prices
4. **Transaction Origin Checks**: Verify `tx.origin != msg.sender`

### User-Level Actions
1. **Monitor Alerts**: Respond to CRITICAL alerts within minutes
2. **Pause Contracts**: Use emergency pause on HIGH alerts
3. **Verify Transactions**: Check recent transactions for patterns
4. **Contact Auditors**: Get professional review for repeated alerts

## Historical Context

Flash loan attacks became prevalent after:
- **2020**: DeFi Summer - Rapid protocol growth
- **Aave/dYdX**: Flash loan primitives introduced
- **2021**: Peak attack year (~$600M stolen)
- **2022-2024**: Increased detection and prevention

## Common Attack Vectors

1. **Price Oracle Manipulation**
   - Borrow → Swap → Oracle reads manipulated price → Profit

2. **Reentrancy with Flash Loans**
   - Borrow → Reenter during callback → Drain funds → Repay

3. **Governance Attacks**
   - Borrow tokens → Vote on proposal → Execute → Return tokens

4. **Arbitrage Exploitation**
   - Borrow → Create price discrepancy → Arbitrage → Repay

## Summary for RAG

**Key Detection Signals:**
- High value (>1000 STT)
- High gas (>300k, especially >1M)
- Complex multi-protocol interactions
- Atomic execution (single transaction)

**Validation Questions:**
1. Is the gas usage proportional to the value transferred?
2. Does the transaction interact with multiple DeFi protocols?
3. Is this address known for similar patterns?
4. Is the value movement justified by the operation?

**Confidence Levels:**
- 90%+: Clear flash loan pattern with multiple indicators
- 75-90%: Likely attack but could be legitimate DeFi
- 60-75%: Suspicious but needs more context
- <60%: Probably false positive
