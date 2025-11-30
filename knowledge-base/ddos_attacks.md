# DDoS Attack Pattern - Knowledge Base

## What is a Contract DDoS Attack?

A Denial of Service attack where an attacker floods a smart contract with a high volume of transactions, attempting to make it unavailable, consume all gas, or clog the network.

## Behavioral Characteristics

### Detection Threshold
- **Frequency Window**: 60 seconds (1 minute)
- **DDoS Threshold**: >10 transactions to same contract
- **Pattern**: Burst of transactions targeting single contract

### Attack Signatures
- **Volume**: Sustained high transaction count
- **Target**: Single contract receives spike
- **Source**: Often multiple addresses (coordinated)
- **Purpose**: Make contract unusable or exploit gas limits

## Real-World Examples

### Fomo3D Gas Limit Attack (2018)
**Pattern:**
- Attacker filled blocks with high-gas transactions
- Prevented others from calling contract
- Won jackpot by blocking legitimate players
- 200+ transactions in final minutes

**Detection:**
```
Alert: DDOS_ATTACK
- Transactions to contract: 45 in 60 seconds
- Target: Fomo3D (0x...)
- Pattern: Block stuffing
- Confidence: 90%
```

### EtherDelta Front-End Attack (2017)
**Pattern:**
- Spam orders to exchange contract
- Degraded contract performance
- Made trading difficult
- 100s of small transactions

**Detection:**
```
Alert: DDOS_ATTACK
- Transactions: 120 in 60 seconds
- Target: EtherDelta (0x...)
- Pattern: Order spam
- Confidence: 85%
```

### CryptoKitties Network Congestion (2017)
**Pattern:** (Accidental DDoS)
- Viral adoption caused massive traffic
- 30% of Ethereum network used
- Contract became unusable
- Legitimate but DDoS-like effect

**Detection:**
```
Alert: DDOS_ATTACK
- Transactions: 200+ in 60 seconds
- Target: CryptoKitties (0x...)
- Pattern: Viral usage
- Confidence: 75% (legitimate popularity)
```

## Detection Logic

### When to Alert

**Severity: HIGH**
- Threshold: >10 transactions in 60 seconds to same contract
- Confidence: 80%
- Impact: Contract availability, network congestion

### Tracking Mechanism

Uses same LRU cache as bot detection but tracks contract (destination):
```
frequencyMap = {
  "contract_0x123...": [timestamp1, timestamp2, timestamp3, ...],
  "contract_0xabc...": [timestamp4, timestamp5, ...]
}

// Alert if array length > 10 within 60-second window
```

## DDoS Attack Types

### 1. Block Stuffing
**Goal**: Fill blocks to prevent other transactions

**Method:**
- Submit many high-gas transactions
- Pay high gas prices to ensure inclusion
- Target specific contract's critical functions

**Example:**
```
Block N:
- 15 transactions from attacker (all to target contract)
- High gas prices (100+ gwei)
- Legitimate users can't get transactions in
```

### 2. State Bloat
**Goal**: Make contract storage expensive

**Method:**
- Create many storage entries
- Increase contract state size
- Make operations progressively more expensive

**Example:**
```
contract Victim {
    mapping(uint => address) public data;

    function addEntry(uint id) public {
        data[id] = msg.sender; // Attacker calls 1000x
    }
}
```

### 3. Unbounded Loops
**Goal**: Cause out-of-gas errors

**Method:**
- Trigger expensive computations
- Exploit loops that iterate over growing arrays
- Make contract functions fail

**Example:**
```
contract Victim {
    address[] public users;

    function distribute() public {
        for (uint i = 0; i < users.length; i++) {
            // Attacker added 10,000 users
            // This function now always fails
        }
    }
}
```

### 4. Computational Exhaustion
**Goal**: Consume all available gas

**Method:**
- Trigger expensive operations (keccak, signatures)
- Nested loops or recursion
- Make contract unusable

## False Positive Scenarios

### Legitimate High Volume

1. **Popular Events**
   - NFT launches (everyone minting)
   - Token sales (high demand)
   - Airdrops (claim rush)
   - **Not DDoS**: Expected legitimate traffic

2. **Viral Applications**
   - Games going viral
   - Trending DeFi protocols
   - Social tokens
   - **Not DDoS**: Organic growth

3. **Integration Traffic**
   - Other contracts calling yours
   - Aggregator routing through you
   - Bridge operations
   - **Not DDoS**: Normal protocol usage

### How to Distinguish

**Malicious DDoS Indicators:**
- Sudden spike (0 to 100 txs/min)
- Coordinated from multiple addresses
- Targeting specific functions
- After vulnerability disclosure
- Small/zero value transactions

**Legitimate Traffic:**
- Gradual increase over time
- Varying transaction types
- From known addresses/protocols
- Matches marketing/announcement timing
- Normal value distributions

## LLM Validation Context

### What to Send to LLM

```json
{
  "finding_type": "DDOS_ATTACK",
  "frequency": {
    "count": 35,
    "window_seconds": 60,
    "target_contract": "0x789..."
  },
  "senders": {
    "unique_addresses": 12,
    "coordinated": true,
    "new_addresses": 8
  },
  "patterns": {
    "same_function": true,
    "small_values": true,
    "high_gas_prices": true,
    "timing": "burst"
  },
  "context": {
    "contract_type": "NFT mint",
    "recent_events": "Launch announced 1 hour ago",
    "baseline_traffic": 5
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
  "reason": "Contract receiving 35 transactions in 60 seconds from 12 coordinated addresses (8 newly created), significantly above baseline of 5 txs/min. Pattern suggests coordinated block stuffing attack.",
  "recommendation": "Consider implementing rate limiting per address. Monitor for continued activity. If attack persists, enable emergency pause function."
}
```

**False Positive (Legitimate Launch):**
```json
{
  "valid": false,
  "confidence": 88,
  "severity": "FALSE_POSITIVE",
  "reason": "High transaction volume matches announced NFT launch timing. Addresses show natural distribution and varying amounts. This is legitimate high demand, not malicious DDoS.",
  "recommendation": "No action needed. This is expected launch traffic. Monitor to ensure it subsides after mint completion."
}
```

## Prevention & Mitigation

### Contract-Level Protections

1. **Rate Limiting Per Address**
```solidity
mapping(address => uint256) public lastAction;
uint256 public constant RATE_LIMIT = 10; // seconds

modifier rateLimit() {
    require(block.timestamp >= lastAction[msg.sender] + RATE_LIMIT);
    lastAction[msg.sender] = block.timestamp;
    _;
}
```

2. **Global Rate Limiting**
```solidity
uint256 public actionsThisBlock;
uint256 public constant MAX_PER_BLOCK = 20;

modifier globalLimit() {
    if (block.number > lastBlockNumber) {
        actionsThisBlock = 0;
        lastBlockNumber = block.number;
    }
    require(actionsThisBlock < MAX_PER_BLOCK);
    actionsThisBlock++;
    _;
}
```

3. **Emergency Pause**
```solidity
bool public paused;

modifier whenNotPaused() {
    require(!paused, "Contract paused");
    _;
}

function pause() external onlyOwner {
    paused = true;
}
```

### Monitoring Strategies

1. **Baseline Tracking**
   - Establish normal transaction volume
   - Alert on deviations >200%
   - Adjust for events/launches

2. **Source Analysis**
   - Track sender diversity
   - Flag coordinated attacks (many new addresses)
   - Whitelist known integrations

3. **Function Call Patterns**
   - Monitor which functions are targeted
   - Different patterns for different attacks
   - Prioritize protecting critical functions

## DDoS vs High Frequency Bot

| Aspect | DDoS | High Frequency Bot |
|--------|------|-------------------|
| **Target** | Contract (destination) | Sender (source) |
| **Threshold** | >10 txs to contract | >5 txs from address |
| **Actors** | Often multiple senders | Single sender |
| **Purpose** | Denial of service | Automation, MEV |
| **Severity** | HIGH | MEDIUM |

## Summary for RAG

**Key Detection Signals:**
- >10 transactions in 60 seconds to same contract
- Burst pattern (sudden spike)
- Often from multiple coordinated addresses
- Targeting specific functions

**Validation Questions:**
1. Is this during announced event (launch, sale)?
2. Are the senders coordinated (many new addresses)?
3. Is traffic proportional to contract's normal volume?
4. Are transaction values suspiciously uniform?
5. Is contract performing normally despite volume?

**Confidence Levels:**
- 90%+: Clear coordinated attack (many new addresses, uniform pattern)
- 80-90%: Likely attack but could be viral adoption
- 70-80%: Suspicious volume but may be legitimate event
- <70%: Probably legitimate high traffic during popularity surge

**Action Recommendations:**
- **CRITICAL**: Enable pause if contract degrading
- **HIGH**: Implement rate limiting
- **MEDIUM**: Monitor pattern, prepare to pause
- **LOW**: Normal high traffic, no action needed

**Attack Prevention Priority:**
1. Rate limiting (most effective)
2. Emergency pause mechanism
3. Gas limit guards
4. Sender whitelisting for critical functions
