# Suspicious Activity Patterns - Knowledge Base

## What is Suspicious Activity?

Catch-all category for unusual blockchain behavior that doesn't fit cleanly into specific attack categories but warrants investigation. These patterns often indicate reconnaissance, preparation for attacks, or novel exploitation techniques.

## Behavioral Characteristics

### General Red Flags
- **Unusual Transaction Patterns**: Behavior deviating from normal user activity
- **Reconnaissance Activity**: Contract probing, test transactions
- **Coordinated Behavior**: Multiple addresses acting in concert
- **Anomalous Gas Usage**: Neither clearly spam nor legitimate
- **Failed Transaction Clusters**: Repeated failures suggesting experimentation

### Detection Philosophy

Unlike specific attack patterns (flash loans, bots, DDoS), suspicious activity detection is **pattern-based** and **context-aware**:

```
Specific Attack: Clear threshold (>5 tx/min = bot)
Suspicious Pattern: Contextual anomaly (why is this new address calling admin functions?)
```

## Suspicious Pattern Types

### 1. Contract Reconnaissance

**Behavior**: Systematically probing contract functions

**Example Pattern:**
```
Block 1000: Call function A → REVERT
Block 1001: Call function B → REVERT
Block 1002: Call function C → REVERT
Block 1003: Call function D → SUCCESS
Block 1004: Call function D with exploit payload
```

**Detection Indicators:**
- Multiple function calls to same contract
- High revert rate (>70%)
- Short time interval between calls
- Final successful transaction after many failures

**Real-World Example:**
```
Attacker probing DeFi protocol (2023):
- Called 47 different functions over 2 minutes
- 43 reverted, 4 succeeded
- Discovered unprotected admin function
- Exploited 10 minutes later for $2M
```

### 2. Test Transactions Before Attack

**Behavior**: Small value transactions testing exploit

**Example Pattern:**
```
Tx 1: Transfer 0.01 STT to test contract
Tx 2: Call exploit function with minimal value
Tx 3: Check if it worked
Tx 4: LARGE transaction with full exploit
```

**Detection Indicators:**
- Small value transactions (<1 STT)
- To newly deployed contracts
- Followed by large value transaction
- Same address, similar calldata

**Real-World Example:**
```
Ronin Bridge Hack (2022):
Before main attack:
- Attacker sent 0.001 ETH test transactions
- Verified withdrawal mechanism
- Checked validator signatures
- Then drained $625M in main attack
```

### 3. Address Funding Patterns

**Behavior**: Suspicious fund routing before attack

**Example Pattern:**
```
Exchange → Mixer → Fresh Address → Attack Contract → Victim
```

**Detection Indicators:**
- New address (age <1 day)
- Funded from mixer/privacy protocol
- Immediately interacts with high-value contract
- No other transaction history

**Code Pattern:**
```javascript
function analyzeFundingPattern(address) {
  const age = getAddressAge(address);
  const fundingSource = getFundingSource(address);
  const targets = getInteractedContracts(address);

  const suspicionScore = 0;

  if (age < 1 day) suspicionScore += 20;
  if (fundingSource.isMixer) suspicionScore += 30;
  if (targets.some(t => t.tvl > 1M)) suspicionScore += 25;
  if (address.txCount < 5) suspicionScore += 15;

  return suspicionScore; // >70 = suspicious
}
```

### 4. Multi-Address Coordination

**Behavior**: Many addresses acting suspiciously similar

**Example Pattern:**
```
Address A: Calls contract X at block 1000
Address B: Calls contract X at block 1001
Address C: Calls contract X at block 1002
All with same calldata, same value, sequential
```

**Detection Indicators:**
- Similar transaction patterns across addresses
- Sequential block numbers
- Identical or near-identical calldata
- Funded from same source

**Detection Logic:**
```javascript
function detectCoordination(transactions) {
  const grouped = groupBySimilarity(transactions);

  for (const group of grouped) {
    if (group.length > 5) {
      // 5+ addresses doing same thing
      const blockSpread = max(group.blocks) - min(group.blocks);

      if (blockSpread < 100) {
        // All within 100 blocks
        return {
          suspicious: true,
          type: 'COORDINATED_ACTIVITY',
          confidence: 80,
          addresses: group.map(tx => tx.from)
        };
      }
    }
  }
}
```

### 5. Abnormal Contract Deployment

**Behavior**: Suspicious smart contract creation

**Detection Indicators:**
- Contract deployed and immediately used for high-value operations
- Contract bytecode similar to known exploits
- Contract deploys other contracts (factory pattern abuse)
- Self-destruct immediately after use

**Example Pattern:**
```
Block N:   Deploy attack contract
Block N+1: Approve attacker to spend victim tokens
Block N+2: Execute exploit
Block N+3: selfdestruct (destroy evidence)
```

**Real-World Example:**
```
Uranium Finance (2021):
1. Deployed malicious migration contract
2. Called migrate() on victim contract
3. Drained $50M
4. Destroyed attack contract
Duration: 4 blocks
```

### 6. Failed High-Value Transactions

**Behavior**: Large transactions that revert

**Detection Indicators:**
- Value >10 STT
- Gas used >200k (significant computation before revert)
- Multiple attempts with slight variations
- Eventually succeeds

**Why Suspicious:**
```
Failed high-value tx suggests:
- Testing exploit parameters
- Insufficient understanding of victim contract
- Race condition attempts
- Trying to bypass protections

Normal users don't repeatedly send 100 STT transactions that fail!
```

**Example:**
```
Transaction 1: Transfer 500 STT → REVERT (insufficient allowance)
Transaction 2: Approve + Transfer 500 STT → REVERT (reentrancy guard)
Transaction 3: Different approach, 500 STT → REVERT (custom error)
Transaction 4: Final attempt, 500 STT → SUCCESS (found vulnerability)
```

### 7. Unusual Contract Interactions

**Behavior**: Calling contracts in unexpected ways

**Examples:**
- EOA calling low-level contract functions directly (not through UI)
- Calling internal/helper functions not meant for external use
- Interacting with paused/deprecated contracts
- Calling functions with unusual parameter combinations

**Detection:**
```javascript
function isUnusualInteraction(tx) {
  const contract = getContract(tx.to);
  const functionSig = tx.data.slice(0, 10);

  // Check if function commonly called by EOAs
  const normalEOAInteractions = [
    'transfer', 'approve', 'swap', 'deposit', 'withdraw'
  ];

  const functionName = contract.getFunction(functionSig);

  if (!normalEOAInteractions.includes(functionName)) {
    // Unusual for EOA to call this function
    return {
      suspicious: true,
      reason: `EOA calling uncommon function: ${functionName}`,
      confidence: 65
    };
  }
}
```

## Real-World Examples

### Poly Network Reconnaissance (2021)

**Before the $611M hack:**
```
Day -3: Attacker studied cross-chain contracts
Day -2: Small test transactions to verify message format
Day -1: Tested keeper role elevation
Day 0:  Full exploit executed
```

**Detection Pattern:**
- New address probing cross-chain contracts
- Multiple reverted transactions
- Gradually increasing values
- Final successful large-scale attack

### Cream Finance Pre-Attack (2021)

**Before the $130M flash loan attack:**
```
Week -1: Address created, funded via Tornado Cash
Day -1:  Small flash loan test (100 ETH)
Hour -1: Medium flash loan test (1000 ETH)
Hour 0:  Massive flash loan attack (500M USDC)
```

**Suspicious Indicators:**
- Fresh address from mixer
- Escalating flash loan sizes
- Testing oracle manipulation
- Clear progression toward attack

### Ronin Bridge (2022)

**Before the $625M exploit:**
```
Compromised validator keys (social engineering)
Tested withdrawal mechanism with small amounts
Verified signature validation
Executed massive withdrawal
```

**Pattern:**
- Validator signing unusual transactions
- Small test withdrawals first
- Then massive coordinated withdrawals
- No user-facing activity, pure contract interaction

## Detection Logic

### Anomaly Scoring System

```javascript
class SuspiciousActivityDetector {

  async analyze(transaction) {
    let suspicionScore = 0;
    const indicators = [];

    // 1. Address Age Analysis
    const addressAge = await getAddressAge(transaction.from);
    if (addressAge < 24 * 3600) { // <1 day
      suspicionScore += 15;
      indicators.push('New address (<1 day old)');
    }

    // 2. Funding Source Analysis
    const fundingSource = await getFundingSource(transaction.from);
    if (fundingSource.type === 'MIXER') {
      suspicionScore += 25;
      indicators.push('Funded from privacy mixer');
    }

    // 3. Failed Transaction History
    const recentTxs = await getRecentTransactions(transaction.from, 10);
    const failureRate = recentTxs.filter(tx => !tx.status).length / recentTxs.length;
    if (failureRate > 0.5) {
      suspicionScore += 20;
      indicators.push(`High failure rate: ${(failureRate*100).toFixed(0)}%`);
    }

    // 4. High-Value Interaction from New Address
    if (addressAge < 7 * 24 * 3600 && transaction.value > 100) {
      suspicionScore += 20;
      indicators.push('High-value tx from new address');
    }

    // 5. Unusual Function Call
    const targetContract = await getContract(transaction.to);
    const functionSig = transaction.data.slice(0, 10);
    const isCommonFunction = await isCommonlyCalledByEOA(functionSig);
    if (!isCommonFunction) {
      suspicionScore += 15;
      indicators.push('Unusual function call for EOA');
    }

    // 6. Contract Deployment + Immediate Use
    if (transaction.creates) {
      const contractAge = 0; // Just deployed
      const nextTx = await getNextTransaction(transaction.from);
      if (nextTx && nextTx.to === transaction.creates) {
        suspicionScore += 25;
        indicators.push('Contract deployed and immediately used');
      }
    }

    return {
      suspicionScore,
      indicators,
      severity: this.calculateSeverity(suspicionScore)
    };
  }

  calculateSeverity(score) {
    if (score >= 70) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    if (score >= 30) return 'LOW';
    return 'INFO';
  }
}
```

### When to Alert

**HIGH Severity (Score ≥70)**:
- Multiple strong indicators
- Pattern matches known attack preparation
- High-value target involved
- Confidence: 75%

**MEDIUM Severity (Score 50-69)**:
- Several moderate indicators
- Unusual but not clearly malicious
- Worth monitoring
- Confidence: 60%

**LOW Severity (Score 30-49)**:
- Few weak indicators
- Could be legitimate unusual activity
- Log for pattern analysis
- Confidence: 40%

## False Positive Scenarios

### Legitimate Unusual Activity

1. **New Protocol Testing**
   - Developers testing new contract deployment
   - Expected to have failed transactions
   - But comes from known team addresses

2. **Power Users**
   - Advanced users calling contracts directly
   - May use uncommon functions
   - But have established address history

3. **Arbitrage Bots**
   - Fresh addresses for MEV operations
   - High frequency, high failure rate
   - But clear profit-seeking pattern, not exploit

4. **Protocol Migrations**
   - Moving funds through new contracts
   - May look like unusual routing
   - But announced and expected

### How to Distinguish

**Suspicious Activity:**
- No public announcement or documentation
- Address has zero reputation
- Targets high-value locked funds
- Pattern matches attack reconnaissance
- Progressive escalation (test → exploit)

**Legitimate Activity:**
- Publicly announced testing
- Known team/community addresses
- Clear business purpose
- Consistent with protocol roadmap
- No privacy obfuscation

## LLM Validation Context

### What to Send to LLM

```json
{
  "finding_type": "SUSPICIOUS_ACTIVITY",
  "suspicion_score": 75,
  "indicators": [
    "New address (<1 day old)",
    "Funded from Tornado Cash",
    "High failure rate: 80%",
    "Targeting high-TVL DeFi protocol"
  ],
  "transaction": {
    "hash": "0x...",
    "from": "0xNEWADDRESS",
    "to": "0xHIGH_VALUE_PROTOCOL",
    "value": "0.1",
    "gas_used": 250000,
    "status": false,
    "function_called": "emergencyWithdraw"
  },
  "address_analysis": {
    "age_seconds": 3600,
    "total_transactions": 8,
    "failed_transactions": 6,
    "funding_source": "Tornado Cash",
    "interacted_contracts": ["0xHIGH_VALUE_PROTOCOL"]
  },
  "context": {
    "target_tvl": "50000000",
    "target_type": "DeFi Lending Protocol",
    "recent_similar_activity": false
  }
}
```

### Expected LLM Response

**Valid Suspicious Activity:**
```json
{
  "valid": true,
  "confidence": 78,
  "severity": "HIGH",
  "reason": "New address funded from privacy mixer is repeatedly calling emergency functions on high-TVL protocol with 80% failure rate, suggesting attack reconnaissance or exploit testing",
  "recommendation": "Monitor this address closely. Alert protocol team about unusual interaction pattern. Consider temporarily pausing emergency functions if abnormal activity continues. Track for pattern escalation."
}
```

**False Positive (Legitimate Testing):**
```json
{
  "valid": false,
  "confidence": 82,
  "severity": "FALSE_POSITIVE",
  "reason": "Address belongs to protocol's own testing team (verified via on-chain verification contract). Failed transactions are part of documented pre-launch security testing announced in governance forum 3 days ago.",
  "recommendation": "No action needed. This is authorized protocol testing. Consider whitelisting known team addresses to reduce false positives during testing phases."
}
```

**Uncertain (Needs Monitoring):**
```json
{
  "valid": true,
  "confidence": 55,
  "severity": "MEDIUM",
  "reason": "Pattern is unusual but not definitively malicious. Could be advanced user testing contract interactions or early-stage attack reconnaissance. Insufficient data for high-confidence classification.",
  "recommendation": "Continue monitoring. Set alert for if this address: 1) Increases transaction frequency, 2) Achieves successful execution, or 3) Targets multiple protocols. Reassess in 24 hours with more data."
}
```

## Prevention & Mitigation

### Protocol-Level

1. **Rate Limiting by Address Age**
```solidity
mapping(address => uint256) public firstSeen;

modifier rateLimitNewAddresses() {
    if (firstSeen[msg.sender] == 0) {
        firstSeen[msg.sender] = block.timestamp;
    }

    if (block.timestamp < firstSeen[msg.sender] + 1 days) {
        // Limit new addresses
        require(msg.value < 10 ether, "New address value limit");
    }
    _;
}
```

2. **Circuit Breakers for Unusual Activity**
```solidity
uint256 public failedCallCount;
uint256 public lastFailedCallBlock;

function sensitiveFunction() external {
    if (!success) {
        if (block.number - lastFailedCallBlock < 10) {
            failedCallCount++;
        } else {
            failedCallCount = 1;
        }
        lastFailedCallBlock = block.number;

        if (failedCallCount > 20) {
            _pause(); // Auto-pause on unusual activity
        }
    }
}
```

3. **Address Reputation Systems**
```solidity
function getAddressReputation(address account) public view returns (uint256) {
    uint256 reputation = 0;

    // Positive factors
    reputation += min(getAddressAge(account) / 1 days, 100);
    reputation += min(getSuccessfulTxCount(account), 100);

    // Negative factors
    reputation -= getFailureRate(account) * 50;
    reputation -= isMixerFunded(account) ? 30 : 0;

    return reputation;
}

modifier requireReputation(uint256 minReputation) {
    require(
        getAddressReputation(msg.sender) >= minReputation,
        "Insufficient address reputation"
    );
    _;
}
```

## Summary for RAG

**Key Detection Signals:**
- New address (<7 days old)
- Funded from privacy mixer
- High transaction failure rate (>50%)
- Unusual function calls for EOA
- Progressive value escalation
- Multiple addresses coordinated
- Contract deploy + immediate use

**Validation Questions:**
1. Is this address age unusual for the operation?
2. Is the funding source privacy-focused?
3. What's the failure rate of recent transactions?
4. Is there a clear progression toward larger operations?
5. Does the target have high value locked?
6. Is there any public announcement of this activity?

**Confidence Levels:**
- 75%+: Multiple strong indicators, matches attack patterns
- 60-75%: Several indicators, worth monitoring
- 40-60%: Unusual but unclear intent
- <40%: Likely legitimate unusual activity

**Action Recommendations:**
- **HIGH**: Alert protocol team, monitor closely, consider rate limiting
- **MEDIUM**: Track address, set alerts for escalation
- **LOW**: Log for pattern analysis, no immediate action

**Investigation Checklist:**
1. Check address age and transaction history
2. Verify funding source (exchange, mixer, or normal transfer)
3. Analyze recent transaction success/failure rate
4. Review target contract TVL and sensitivity
5. Search for public announcements of activity
6. Check if similar patterns from other addresses
7. Monitor for value escalation over time
