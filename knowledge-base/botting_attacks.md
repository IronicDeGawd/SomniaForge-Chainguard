# High Frequency Botting - Knowledge Base

## What is High Frequency Botting?

Automated scripts or bots that execute a high volume of transactions from a single address in a short time period, often for market manipulation, MEV extraction, or front-running.

## Behavioral Characteristics

### Detection Threshold
- **Frequency Window**: 60 seconds (1 minute)
- **Bot Threshold**: >5 transactions from same sender
- **Pattern**: Rapid-fire transactions with consistent timing

### Transaction Signatures
- **Timing**: Regular intervals (e.g., every 2-3 seconds)
- **Gas Price**: Often elevated to ensure inclusion
- **Value**: Usually small amounts (automated operations)
- **Function Calls**: Repeated identical calls

## Real-World Examples

### MEV Bots (Legitimate Use Case)
**Pattern:**
- 10-50 transactions per minute
- Front-running DEX swaps
- Consistent gas prices (priority fees)
- High success rate

**Detection:**
```
Alert: HIGH_FREQUENCY_BOT
- Transactions: 15 in 60 seconds
- From: 0x123... (MEV bot)
- Pattern: Front-running swaps
- Confidence: 85%
```

### Sybil Attack (Malicious)
**Pattern:**
- 20-100 transactions per minute
- Small value transfers
- Creating fake activity
- Gaming reward systems

**Detection:**
```
Alert: HIGH_FREQUENCY_BOT
- Transactions: 45 in 60 seconds
- From: 0xabc... (attacker)
- Pattern: Artificial volume
- Confidence: 90%
```

### NFT Minting Bots
**Pattern:**
- Burst activity during launches
- 30+ transactions in seconds
- Automated contract calls
- Monopolizing supply

**Detection:**
```
Alert: HIGH_FREQUENCY_BOT
- Transactions: 32 in 15 seconds
- From: 0xdef... (mint bot)
- Pattern: Rapid minting
- Confidence: 95%
```

## Detection Logic

### When to Alert

**Severity: MEDIUM**
- Threshold: >5 transactions in 60 seconds
- Confidence: 85%
- Impact: Potential market manipulation or spam

### Tracking Mechanism

Uses LRU cache to track timestamps:
```
frequencyMap = {
  "0x123...": [timestamp1, timestamp2, timestamp3, ...],
  "0xabc...": [timestamp4, timestamp5, ...]
}

// Alert if array length > 5 within 60-second window
```

**Memory Management:**
- Max 10,000 addresses tracked
- Automatic TTL expiration (2 minutes)
- Periodic cleanup every 5 minutes

## False Positive Scenarios

### Legitimate High Frequency

1. **Automated Trading Bots** (Authorized)
   - Market makers providing liquidity
   - Arbitrage bots balancing prices
   - Known addresses with reputation

2. **Batch Operations**
   - Airdrops sending to multiple addresses
   - Multi-signature wallet operations
   - Protocol upgrades/migrations

3. **Popular Contracts During Events**
   - NFT launches (everyone minting)
   - Token sales (high demand)
   - Yield farming rushes

### How to Distinguish

**Malicious Bot Indicators:**
- Consistent transaction amounts
- Targeting single contract repeatedly
- No variation in gas prices
- Newly created address

**Legitimate Activity:**
- Varying transaction amounts
- Multiple contracts interacted with
- Dynamic gas pricing
- Established address history

## LLM Validation Context

### What to Send to LLM

```json
{
  "finding_type": "HIGH_FREQUENCY_BOT",
  "frequency": {
    "count": 12,
    "window_seconds": 60,
    "avg_interval": 5
  },
  "sender": "0x1234...",
  "patterns": {
    "same_contract": true,
    "same_function": true,
    "same_value": false,
    "consistent_gas": true
  },
  "recent_transactions": [
    { "hash": "0xa...", "timestamp": 1234567890, "gas": 150000 },
    { "hash": "0xb...", "timestamp": 1234567895, "gas": 150000 }
  ]
}
```

### Expected LLM Response

**Valid Bot:**
```json
{
  "valid": true,
  "confidence": 88,
  "severity": "MEDIUM",
  "reason": "Sender executed 12 identical transactions in 60 seconds with consistent timing and gas, indicating automated bot activity potentially for front-running or market manipulation",
  "recommendation": "Monitor this address for continued activity. If it's MEV bot, consider it normal. If targeting your contract specifically, may need rate limiting."
}
```

**False Positive:**
```json
{
  "valid": false,
  "confidence": 85,
  "severity": "FALSE_POSITIVE",
  "reason": "High frequency is from legitimate NFT minting event with many users participating simultaneously. Transactions show natural variation in timing and amounts.",
  "recommendation": "No action needed. This is expected high activity during popular events."
}
```

## Prevention & Mitigation

### Contract-Level Protections
1. **Rate Limiting**: Limit transactions per address per block
2. **Cooldown Periods**: Require time delay between operations
3. **CAPTCHA-like Mechanisms**: Proof-of-work for critical operations
4. **Whitelist**: Known addresses bypass restrictions

### Example Rate Limit Implementation
```solidity
mapping(address => uint256) public lastAction;
uint256 public constant COOLDOWN = 10 seconds;

modifier rateLimit() {
    require(
        block.timestamp >= lastAction[msg.sender] + COOLDOWN,
        "Too frequent"
    );
    lastAction[msg.sender] = block.timestamp;
    _;
}

function sensitiveOperation() external rateLimit {
    // Protected logic
}
```

### Monitoring Strategies
1. **Track Known Bots**: Whitelist legitimate MEV bots
2. **Pattern Analysis**: Distinguish malicious vs helpful bots
3. **Gas Price Monitoring**: Bots often use similar gas strategies
4. **Address Reputation**: New addresses more suspicious

## Bot Categories

### 1. MEV Bots (Mostly Harmless)
- **Front-running**: Detect profitable transactions and execute first
- **Back-running**: Execute after large swaps for arbitrage
- **Sandwich Attacks**: Front and back-run user transactions
- **Impact**: Extractive but part of DeFi ecosystem

### 2. Spam Bots (Malicious)
- **Fake Volume**: Create artificial activity
- **Network Congestion**: Clog network with junk transactions
- **Gas Price Manipulation**: Inflate gas prices
- **Impact**: Negative, wastes resources

### 3. Gaming Bots (Exploitative)
- **NFT Sniping**: Monopolize limited supply
- **Reward Farming**: Abuse incentive systems
- **Vote Manipulation**: Sybil attacks on governance
- **Impact**: Unfair advantage, harms users

## Common Bot Patterns

### Pattern 1: Consistent Timing
```
Tx1: 10:00:00
Tx2: 10:00:03
Tx3: 10:00:06
Tx4: 10:00:09
→ Exactly 3-second intervals = Bot
```

### Pattern 2: Identical Operations
```
All transactions:
- Same function: mint()
- Same gas: 150,000
- Same value: 0.1 ETH
→ Automated script
```

### Pattern 3: New Address Rush
```
Address created: 10:00:00
First tx: 10:00:05
10 more txs: 10:00:05 - 10:01:00
→ Bot wallet
```

## Summary for RAG

**Key Detection Signals:**
- >5 transactions in 60 seconds from same address
- Consistent timing intervals
- Repeated identical operations
- Often targeting single contract

**Validation Questions:**
1. Is this a known MEV bot address?
2. Are the transactions identical or varying?
3. Is this during a popular event (NFT launch)?
4. Is the address newly created?

**Confidence Levels:**
- 90%+: Clear bot pattern (identical ops, consistent timing)
- 80-90%: Likely bot but could be burst user activity
- 70-80%: Suspicious frequency but inconclusive
- <70%: Probably legitimate high activity

**Action Recommendations:**
- **CRITICAL**: Block address if gaming/exploiting
- **HIGH**: Monitor if MEV bot (normal DeFi activity)
- **MEDIUM**: Observe pattern before action
- **LOW**: Likely false positive during events
