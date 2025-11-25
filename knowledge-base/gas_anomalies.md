# Gas Anomaly Detection Knowledge Base

## Definition

Gas anomalies are unexpected deviations in gas consumption patterns that may indicate bugs, inefficiencies, or potential denial-of-service (DoS) attacks. Monitoring gas usage helps identify performance issues and security threats before they cause problems.

## Gas Anomaly Types

### Type 1: Sudden Spike (>50% increase)
**Indicator**: Function uses significantly more gas than baseline

**Causes**:
- Unbounded loops
- Large array operations
- Excessive storage writes
- DoS attack in progress
- State bloat

### Type 2: Gradual Increase
**Indicator**: Gas usage slowly increases over time

**Causes**:
- Growing arrays/mappings
- Accumulating state
- Memory leaks (in complex contracts)

### Type 3: Inconsistent Usage
**Indicator**: Same function has wildly different gas costs

**Causes**:
- Input-dependent complexity
- Conditional storage operations
- External call variations

### Type 4: Unexpectedly Low
**Indicator**: Function uses less gas than expected

**Causes**:
- Early revert (not necessarily bad)
- Missing operations
- Logic error

## Detection Methodology

### Baseline Calculation

**Method 1: Rolling Average**
```javascript
class GasBaseline {
  constructor(windowSize = 100) {
    this.measurements = {};
    this.windowSize = windowSize;
  }
  
  addMeasurement(functionSig, gasUsed) {
    if (!this.measurements[functionSig]) {
      this.measurements[functionSig] = [];
    }
    
    this.measurements[functionSig].push(gasUsed);
    
    // Keep only last N measurements
    if (this.measurements[functionSig].length > this.windowSize) {
      this.measurements[functionSig].shift();
    }
  }
  
  getBaseline(functionSig) {
    const measurements = this.measurements[functionSig] || [];
    if (measurements.length === 0) return null;
    
    const sum = measurements.reduce((a, b) => a + b, 0);
    return sum / measurements.length;
  }
  
  getStdDev(functionSig) {
    const measurements = this.measurements[functionSig] || [];
    if (measurements.length < 2) return 0;
    
    const avg = this.getBaseline(functionSig);
    const squareDiffs = measurements.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / measurements.length;
    return Math.sqrt(avgSquareDiff);
  }
}
```

**Method 2: Percentile-Based**
```javascript
function getPercentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Use 75th percentile as baseline (more robust to outliers)
const baseline = getPercentile(measurements, 75);
```

### Anomaly Detection

**Statistical Approach**:
```javascript
function detectAnomaly(gasUsed, baseline, stdDev) {
  const deviation = (gasUsed - baseline) / baseline;
  const zScore = (gasUsed - baseline) / stdDev;
  
  return {
    deviation: deviation * 100, // Percentage
    zScore,
    severity: calculateSeverity(deviation, zScore)
  };
}

function calculateSeverity(deviation, zScore) {
  if (deviation > 2.0 || zScore > 3) return 'CRITICAL'; // >200% or >3σ
  if (deviation > 1.0 || zScore > 2) return 'HIGH';     // >100% or >2σ
  if (deviation > 0.5 || zScore > 1) return 'MEDIUM';   // >50% or >1σ
  return 'LOW';
}
```

## Common Gas-Intensive Operations

### Storage Operations
```solidity
// SSTORE: ~20,000 gas (new) or ~5,000 gas (update)
mapping(address => uint256) public balances;

function updateBalance(address user, uint256 amount) external {
    balances[user] = amount; // Expensive!
}
```

### Loops
```solidity
// DANGEROUS: Unbounded loop
function distributeRewards(address[] memory recipients) external {
    for (uint i = 0; i < recipients.length; i++) {
        balances[recipients[i]] += reward; // O(n) SSTORE operations
    }
}

// Gas cost: ~25,000 * recipients.length
// With 100 recipients: ~2.5M gas
// With 1000 recipients: ~25M gas (exceeds block limit!)
```

### Array Operations
```solidity
// Expensive: Growing arrays
address[] public users;

function addUser(address user) external {
    users.push(user); // Cost increases with array size
}

// Reading entire array
function getAllUsers() external view returns (address[] memory) {
    return users; // Cost: O(n)
}
```

## DoS Attack Patterns

### Pattern 1: Griefing via Unbounded Loop
```solidity
// VULNERABLE
contract Auction {
    address[] public bidders;
    
    function bid() external payable {
        bidders.push(msg.sender);
    }
    
    function refundAll() external {
        // VULNERABLE: Attacker can make this impossible to execute
        for (uint i = 0; i < bidders.length; i++) {
            payable(bidders[i]).transfer(bids[bidders[i]]);
        }
    }
}
```

**Attack**: Attacker creates thousands of small bids, making `refundAll()` exceed block gas limit.

### Pattern 2: Storage Bloat
```solidity
// VULNERABLE
mapping(address => uint256[]) public userTransactions;

function recordTransaction(uint256 amount) external {
    userTransactions[msg.sender].push(amount);
    // Attacker can bloat storage, making reads expensive
}
```

### Pattern 3: Expensive Fallback
```solidity
// VULNERABLE
function sendRewards(address[] memory winners) external {
    for (uint i = 0; i < winners.length; i++) {
        winners[i].call{value: reward}(""); // If fallback is expensive...
    }
}
```

## Real-World Examples

### GovernMental Ponzi (2016)
**Issue**: Unbounded loop caused contract to lock

**Vulnerable Code**:
```solidity
function lendGovernmentMoney() public payable {
    // ... logic ...
    
    // VULNERABLE: Loop over all creditors
    for (uint i = 0; i < creditorAddresses.length; i++) {
        creditorAddresses[i].send(creditorAmounts[i]);
    }
}
```

**Result**: After ~1100 creditors, function exceeded block gas limit.

### CryptoKitties (2017)
**Issue**: Expensive breeding function caused network congestion

**Gas Spike**: Breeding function cost 200,000+ gas
**Impact**: Network congestion, high fees

### Fomo3D (2018)
**Issue**: Attacker used block stuffing to win

**Attack**: Filled blocks with high-gas transactions to prevent others from bidding
**Gas Used**: Attacker spent ~$50k in gas fees to win $3M prize

## Optimization Recommendations

### Recommendation 1: Limit Loop Iterations
```solidity
// BAD
function processAll(address[] memory users) external {
    for (uint i = 0; i < users.length; i++) {
        process(users[i]);
    }
}

// GOOD
uint256 constant MAX_BATCH = 50;

function processBatch(address[] memory users, uint256 startIndex) external {
    uint256 endIndex = min(startIndex + MAX_BATCH, users.length);
    
    for (uint i = startIndex; i < endIndex; i++) {
        process(users[i]);
    }
}
```

### Recommendation 2: Use Pull Over Push
```solidity
// BAD: Push pattern
function distributeRewards(address[] memory users) external {
    for (uint i = 0; i < users.length; i++) {
        users[i].call{value: reward}("");
    }
}

// GOOD: Pull pattern
mapping(address => uint256) public pendingRewards;

function claimReward() external {
    uint256 amount = pendingRewards[msg.sender];
    pendingRewards[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
}
```

### Recommendation 3: Optimize Storage
```solidity
// BAD: Multiple SSTORE operations
function updateUser(address user, uint256 balance, uint256 score) external {
    userBalances[user] = balance;  // SSTORE
    userScores[user] = score;      // SSTORE
}

// GOOD: Pack into struct, single SSTORE
struct User {
    uint128 balance;
    uint128 score;
}
mapping(address => User) public users;

function updateUser(address user, uint128 balance, uint128 score) external {
    users[user] = User(balance, score); // Single SSTORE
}
```

### Recommendation 4: Cache Storage Reads
```solidity
// BAD: Multiple SLOAD operations
function calculate() external view returns (uint256) {
    return baseValue * multiplier + baseValue * divisor + baseValue;
    // baseValue read 3 times from storage
}

// GOOD: Cache in memory
function calculate() external view returns (uint256) {
    uint256 base = baseValue; // Single SLOAD
    return base * multiplier + base * divisor + base;
}
```

## Validation Criteria

### True Anomaly Indicators
1. ✅ Deviation >50% from baseline
2. ✅ Z-score >2 (2 standard deviations)
3. ✅ Sudden spike (not gradual increase)
4. ✅ Consistent pattern across multiple calls
5. ✅ No obvious input-dependent reason

### False Positive Indicators
1. ❌ First few calls (no baseline yet)
2. ❌ Input-dependent complexity (expected variation)
3. ❌ Legitimate state changes (e.g., first-time initialization)
4. ❌ Small absolute difference (<10,000 gas)
5. ❌ Within normal variance (z-score <1)

### Severity Assessment

**CRITICAL** (>200% increase):
- Likely DoS attack or critical bug
- Function may exceed block gas limit
- Immediate investigation required

**HIGH** (100-200% increase):
- Significant inefficiency
- Potential DoS vector
- Should be optimized

**MEDIUM** (50-100% increase):
- Notable deviation
- Monitor for pattern
- Consider optimization

**LOW** (<50% increase):
- Within normal variance
- May be input-dependent
- No immediate action needed

## Monitoring Strategy

### Real-Time Monitoring
```javascript
const gasMonitor = {
  baselines: new GasBaseline(),
  
  async monitorTransaction(tx) {
    const functionSig = tx.data.slice(0, 10);
    const gasUsed = tx.gasUsed;
    
    // Get baseline
    const baseline = this.baselines.getBaseline(functionSig);
    
    if (baseline) {
      const stdDev = this.baselines.getStdDev(functionSig);
      const anomaly = detectAnomaly(gasUsed, baseline, stdDev);
      
      if (anomaly.severity !== 'LOW') {
        await emitAlert({
          type: 'GAS_ANOMALY',
          severity: anomaly.severity,
          functionSig,
          gasUsed,
          baseline,
          deviation: anomaly.deviation,
          txHash: tx.hash
        });
      }
    }
    
    // Update baseline
    this.baselines.addMeasurement(functionSig, gasUsed);
  }
};
```

### Historical Analysis
```javascript
async function analyzeGasTrends(contractAddress, functionSig, days = 7) {
  const transactions = await getTransactions(contractAddress, days);
  const measurements = transactions
    .filter(tx => tx.data.startsWith(functionSig))
    .map(tx => ({ timestamp: tx.timestamp, gas: tx.gasUsed }));
  
  // Detect trends
  const trend = calculateTrend(measurements);
  
  return {
    averageGas: mean(measurements.map(m => m.gas)),
    trend: trend.direction, // 'increasing', 'decreasing', 'stable'
    trendStrength: trend.strength,
    recommendation: generateRecommendation(trend)
  };
}
```

## LLM Validation Prompts

### Prompt Template
```
You are a smart contract gas optimization expert.

FINDING:
Type: Gas Anomaly
Function: {function_name}
Contract: {contract_address}

DATA:
- Current gas: {current_gas}
- Baseline gas: {baseline_gas}
- Deviation: {deviation}%
- Z-score: {z_score}

CONTEXT:
- Function signature: {function_sig}
- Recent calls: {recent_call_count}
- Input parameters: {input_params}

QUESTION:
Is this a genuine gas anomaly requiring attention?

Consider:
1. Is deviation significant enough to warrant concern?
2. Could this be input-dependent (e.g., array length)?
3. Is this a DoS attack pattern?
4. Are there optimization opportunities?

Respond in JSON:
{
  "valid": true/false,
  "confidence": 0-100,
  "severity": "CRITICAL/HIGH/MEDIUM/LOW/FALSE_POSITIVE",
  "reason": "one sentence explanation",
  "recommendation": "specific optimization or action"
}
```

## References

- [Ethereum Gas Costs](https://ethereum.org/en/developers/docs/gas/)
- [Solidity Gas Optimization](https://github.com/iskdrews/awesome-solidity-gas-optimization)
- [DoS with Block Gas Limit](https://consensys.github.io/smart-contract-best-practices/attacks/denial-of-service/)
