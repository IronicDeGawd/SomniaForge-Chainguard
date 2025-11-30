# Spam / State Bloat Attack - Knowledge Base

## What is a Spam Attack?

An attack where malicious actors send many transactions with zero value but high gas usage to bloat blockchain state, waste network resources, or make contracts expensive to use.

## Behavioral Characteristics

### Detection Criteria
- **High Gas Usage**: >1,000,000 gas consumed
- **Zero Value**: No ETH/STT transferred
- **Purpose**: Bloat state, waste resources, increase costs

### Attack Signatures
- Massive gas consumption without value transfer
- Creating unnecessary storage entries
- Triggering expensive computations
- Making contract operations progressively costlier

## Real-World Examples

### Ethereum Name Service (ENS) Spam (2017)
**Pattern:**
- Attackers registered thousands of names
- Each registration: ~200k gas, 0 ETH
- Goal: Bloat ENS registry
- Made lookups expensive

**Detection:**
```
Alert: SPAM_ATTACK
- Gas used: 1,500,000
- Value: 0 STT
- Pattern: Mass registration
- Confidence: 90%
```

### ERC-20 Airdrop Spam (Ongoing)
**Pattern:**
- Send worthless tokens to millions of addresses
- Each transfer: ~50k gas
- Goal: Clog wallets, phishing
- Network resource waste

**Detection:**
```
Alert: SPAM_ATTACK
- Gas used: 2,000,000 (batch transfer)
- Value: 0 STT
- Pattern: Mass token distribution
- Confidence: 85%
```

### Storage Bloat Attack (Various)
**Pattern:**
- Write garbage data to contract storage
- Each write: SSTORE opcode (~20k gas)
- Accumulates over time
- Makes contract state expensive

**Detection:**
```
Alert: SPAM_ATTACK
- Gas used: 5,000,000
- Value: 0 STT
- Pattern: Massive storage writes
- Confidence: 95%
```

## Detection Logic

### When to Alert

**Severity: HIGH**
- Threshold: Gas >1,000,000 AND Value == 0
- Confidence: 85%
- Impact: Network congestion, increased costs

### Gas Consumption Breakdown

**Why 1M gas is significant:**
```
Simple transfer:      21,000 gas
Token transfer:       50,000 gas
Complex DeFi swap:    300,000 gas
Flash loan:           500,000-2M gas
Spam attack:          1M-10M+ gas (with 0 value!)
```

**1M gas can write:**
- ~50 storage slots (SSTORE = 20k gas each)
- ~200 array entries
- ~1000 event logs
- Significant state bloat

## Spam Attack Types

### 1. Storage Bloat
**Goal**: Make contract state expensive

**Method:**
```solidity
contract Victim {
    mapping(uint => bytes32) public data;

    function addData(uint id, bytes32 value) public {
        data[id] = value; // No access control!
    }
}

// Attacker calls:
for (i = 0; i < 1000; i++) {
    victim.addData(i, randomBytes);
}
// Result: Contract storage bloated, operations expensive
```

**Detection:**
- Gas: 20,000,000 (1000 SSTOREs)
- Value: 0
- Alert: SPAM_ATTACK

### 2. Event Log Spam
**Goal**: Bloat event logs, hide legitimate events

**Method:**
```solidity
contract Victim {
    event DataAdded(uint id, bytes32 data);

    function spam() public {
        for (uint i = 0; i < 1000; i++) {
            emit DataAdded(i, keccak256(abi.encode(i)));
        }
    }
}
```

**Detection:**
- Gas: 5,000,000+ (many LOG opcodes)
- Value: 0
- Alert: SPAM_ATTACK

### 3. Computational Waste
**Goal**: Waste network resources

**Method:**
```solidity
contract Victim {
    function wasteGas(uint iterations) public {
        uint result;
        for (uint i = 0; i < iterations; i++) {
            result = uint(keccak256(abi.encode(result, i)));
        }
    }
}

// Attacker calls: wasteGas(100000)
```

**Detection:**
- Gas: 10,000,000+
- Value: 0
- Alert: SPAM_ATTACK

### 4. State Transition Spam
**Goal**: Force expensive state reads/writes

**Method:**
- Trigger functions that iterate over large arrays
- Force contract to traverse deep storage
- Make operations O(n²) instead of O(1)

## False Positive Scenarios

### Legitimate High Gas with Zero Value

1. **Contract Initialization**
   - Deploying contracts: 0 value, high gas
   - Setting up initial state
   - Not spam, just deployment

2. **State Cleanup Operations**
   - Deleting old data (refunds gas but consumes initially)
   - Garbage collection
   - Legitimate maintenance

3. **Cross-Contract Calls**
   - Contract A calling Contract B
   - No ETH transfer but complex logic
   - Normal inter-contract communication

4. **Oracle Updates**
   - Price feed updates
   - External data writes
   - High gas, zero value, but necessary

### How to Distinguish

**Spam Indicators:**
- Repeated identical operations
- From unknown/new addresses
- No clear business logic
- Unusually high gas for operation type
- Targeting public unprotected functions

**Legitimate Operations:**
- From known addresses (deployers, admins)
- Clear business purpose
- Expected gas for operation
- Protected by access control
- Part of normal protocol operations

## LLM Validation Context

### What to Send to LLM

```json
{
  "finding_type": "SPAM_ATTACK",
  "transaction": {
    "hash": "0x...",
    "gas_used": 3500000,
    "value": "0",
    "from": "0x123...",
    "to": "0x789...",
    "function_called": "addMultipleEntries",
    "status": "success"
  },
  "analysis": {
    "storage_writes": 150,
    "event_logs": 50,
    "computation_heavy": true,
    "sender_reputation": "unknown"
  },
  "context": {
    "contract_type": "registry",
    "has_access_control": false,
    "previous_similar": 0
  }
}
```

### Expected LLM Response

**Valid Spam:**
```json
{
  "valid": true,
  "confidence": 92,
  "severity": "HIGH",
  "reason": "Transaction consumed 3.5M gas with zero value transfer, writing 150 storage entries to unprotected public function. Pattern matches state bloat attack.",
  "recommendation": "Add access control to prevent unauthorized state writes. Implement rate limiting. Consider storage rent mechanisms."
}
```

**False Positive (Legitimate Batch):**
```json
{
  "valid": false,
  "confidence": 88,
  "severity": "FALSE_POSITIVE",
  "reason": "High gas usage is from legitimate batch operation by contract admin for initial data population. Transaction serves clear business purpose.",
  "recommendation": "No immediate action needed, but consider implementing access control if not present to prevent future abuse."
}
```

## Prevention & Mitigation

### Contract-Level Protections

1. **Access Control**
```solidity
modifier onlyAuthorized() {
    require(authorized[msg.sender], "Not authorized");
    _;
}

function addData(bytes32 data) external onlyAuthorized {
    // Protected from spam
}
```

2. **Rate Limiting**
```solidity
mapping(address => uint256) public operations;
mapping(uint256 => uint256) public blockOperations;

modifier rateLimit(uint maxOps) {
    uint currentBlock = block.number;
    if (currentBlock > lastResetBlock) {
        blockOperations[currentBlock] = 0;
        lastResetBlock = currentBlock;
    }
    require(blockOperations[currentBlock] < maxOps, "Rate limit");
    blockOperations[currentBlock]++;
    _;
}
```

3. **Gas Limits**
```solidity
modifier gasLimit(uint maxGas) {
    uint gasStart = gasleft();
    _;
    require(gasStart - gasleft() < maxGas, "Gas exceeded");
}

function expensive() external gasLimit(500000) {
    // Limits gas consumption
}
```

4. **Fee Mechanisms**
```solidity
uint public constant FEE = 0.01 ether;

function addEntry(bytes32 data) external payable {
    require(msg.value >= FEE, "Insufficient fee");
    // Economic deterrent to spam
}
```

## Impact Analysis

### Network Impact
- **Blockchain Bloat**: Permanent storage increase
- **Sync Time**: New nodes take longer to sync
- **Costs**: Higher gas prices for everyone
- **Performance**: Slower state access

### Contract Impact
- **Gas Costs**: Operations become expensive
- **Usability**: Users can't afford to use contract
- **Attacks**: Creates attack surface for DoS
- **Maintenance**: Difficult to clean up bloat

### Economic Impact
- **User Costs**: Higher fees to interact
- **Network Costs**: Validators need more resources
- **Spam Costs**: Often cheap for attacker
- **Defense Costs**: Expensive to mitigate

## Spam vs Other Attacks

| Attack Type | Value | Gas | Goal |
|-------------|-------|-----|------|
| **Spam** | 0 | Very High (>1M) | Bloat state |
| **DDoS** | Low | Medium | Deny service |
| **Flash Loan** | Very High | High | Drain funds |
| **Bot** | Varies | Normal | Automation |

## Summary for RAG

**Key Detection Signals:**
- Gas usage >1,000,000
- Value transfer = 0
- Often many storage writes or events
- No clear value exchange

**Validation Questions:**
1. Is this from a known admin/deployer address?
2. Does the gas consumption match the operation?
3. Is there clear business logic for zero-value high-gas?
4. Are there protections (access control, fees)?
5. Is this a one-time setup or repeated pattern?

**Confidence Levels:**
- 90%+: Clear spam (unknown address, massive gas, no purpose)
- 80-90%: Likely spam but could be batch operation
- 70-80%: Suspicious but may have legitimate reason
- <70%: Probably legitimate high-gas operation

**Action Recommendations:**
- **CRITICAL**: Add access control immediately
- **HIGH**: Implement rate limiting and fees
- **MEDIUM**: Monitor for repeated occurrences
- **LOW**: Verify it's legitimate, document

**Prevention Priority:**
1. Access control (most important)
2. Economic fees (spam deterrent)
3. Rate limiting (prevent burst)
4. Gas limits (cap consumption)
