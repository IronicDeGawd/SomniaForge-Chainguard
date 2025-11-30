# Governance Attack Pattern - Knowledge Base

## What is a Governance Attack?

A governance attack exploits voting mechanisms in decentralized protocols to pass malicious proposals, drain treasury funds, or manipulate protocol parameters. Attackers often use flash loans to acquire massive temporary voting power.

## Behavioral Characteristics

### Detection Criteria
- **Large Token Accumulation**: Sudden acquisition of governance tokens
- **Immediate Voting**: Voting right after token acquisition
- **Proposal Execution**: Fast-track proposal with minimal time delay
- **Token Return**: Returning tokens immediately after vote

### Attack Signatures
- Flash loan → Buy governance tokens → Vote → Execute → Sell tokens
- All within single transaction or block
- Unusual voting pattern (new address with massive votes)
- Proposals that benefit the proposer directly

## Real-World Examples

### Beanstalk Farms (2022) - $182M Loss
**Pattern:**
- Attacker borrowed $1B in flash loans
- Converted to 79% governance voting power
- Passed malicious proposal (BIP-18)
- Drained $182M to attacker address
- Repaid flash loan, kept profit

**Transaction Pattern:**
```
1. Flash loan: 350k ETH, 500M USDC, 150M USDT
2. Swap → 79% of Beanstalk voting power
3. Propose + Vote + Execute (all in one tx)
4. Drain: $182M to attacker
5. Return flash loan
Duration: 13 seconds
```

**Detection:**
```
Alert: GOVERNANCE_ATTACK
- Value: 182,000,000 STT transferred
- Gas used: 3,500,000
- Pattern: Flash loan + Vote + Execute + Return
- Voting power spike: 0% → 79% → 0%
- Confidence: 95%
```

### Tornado Cash Governance (2023) - Takeover Attempt
**Pattern:**
- Attacker accumulated TORN tokens via multiple addresses
- Created malicious proposal to grant admin rights
- Used social engineering + vote manipulation
- Community detected and rejected

**Detection:**
```
Alert: GOVERNANCE_ATTACK
- Pattern: Multiple addresses voting same proposal
- Proposal creates new admin role
- Voting power: Distributed but coordinated
- Confidence: 75% (Sybil attack variant)
```

### Build Finance (2021) - $470k Loss
**Pattern:**
- Flash loan to acquire BUILD tokens
- Voted to transfer treasury to attacker
- Executed proposal immediately
- No timelock protection

**Detection:**
```
Alert: GOVERNANCE_ATTACK
- Flash loan: 25,000 ETH
- Voting power: 100% (single voter)
- Proposal execution: Same block as vote
- Treasury drain: $470k
- Confidence: 98%
```

## Detection Logic

### When to Alert

**Severity: CRITICAL**
- Flash loan + governance token acquisition + vote + execute
- Treasury funds transferred to proposer
- Voting power >50% from new address
- No timelock delay
- Confidence: 90%+

**Severity: HIGH**
- Large token accumulation before vote (Threshold: >25 STT)
- Proposal execution within 1-2 blocks of vote
- Single address controls >33% votes
- Confidence: 80%+

**Severity: MEDIUM**
- Unusual voting pattern (many new addresses)
- Coordinated voting behavior
- Suspicious proposal content
- Confidence: 70%+

### Transaction Pattern Analysis

**Flash Loan Governance Attack:**
```
Block N:
├─ Tx 1: Flash Loan (borrow massive tokens)
├─ Tx 2: Swap tokens → Governance tokens
├─ Tx 3: createProposal(malicious)
├─ Tx 4: vote(proposalId, support)
├─ Tx 5: execute(proposalId)
├─ Tx 6: Drain treasury
├─ Tx 7: Swap governance tokens back
└─ Tx 8: Repay flash loan

All in single block or transaction!
```

**Non-Flash Loan Variant:**
```
Block N-100: Start accumulating governance tokens
Block N-50:  Control >33% voting power
Block N-10:  Submit malicious proposal
Block N:     Vote passes, execute, drain
```

## Governance Attack Types

### 1. Flash Loan Governance Takeover
**Goal**: Acquire temporary voting majority

**Method:**
```solidity
contract Attack {
    function attack() external {
        // 1. Flash loan
        flashLoan(1000000 ether);

        // 2. Buy governance tokens
        swap(USDC, GOV_TOKEN);

        // 3. Delegate votes to self
        govToken.delegate(address(this));

        // 4. Create and vote on malicious proposal
        uint proposalId = governance.propose(
            targets,
            values,
            calldatas,
            "Transfer treasury to attacker"
        );
        governance.castVote(proposalId, 1); // Vote YES

        // 5. Execute (if no timelock)
        governance.execute(proposalId);

        // 6. Cleanup and return loan
        swap(GOV_TOKEN, USDC);
        repayFlashLoan();
    }
}
```

**Detection Indicators:**
- High value transfer (flash loan amount)
- Extremely high gas (>1M)
- Governance contract interactions
- Treasury drain pattern

### 2. Sybil Governance Attack
**Goal**: Control votes through many addresses

**Method:**
- Create 100+ addresses
- Distribute governance tokens
- Coordinate votes on malicious proposal
- Appears decentralized but isn't

**Detection:**
```javascript
// Pattern: Many addresses voting same way
const voters = getVotersForProposal(proposalId);
const votingPattern = analyzeVotingPattern(voters);

if (votingPattern.sybilScore > 0.8) {
  // Likely coordinated attack
  alert({
    type: 'GOVERNANCE_ATTACK',
    subtype: 'SYBIL_ATTACK',
    confidence: votingPattern.sybilScore * 100
  });
}
```

### 3. Proposal Griefing
**Goal**: Spam governance with malicious proposals

**Method:**
- Submit many low-quality proposals
- Waste community time reviewing
- Hide malicious proposal in noise
- DoS governance process

**Detection:**
- Multiple proposals from same address
- Rapid proposal submission
- Low-effort proposal content

## False Positive Scenarios

### Legitimate Large Governance Actions

1. **Whale Voting**
   - Long-term holder with large position
   - Not flash loan funded
   - Transparent identity
   - Normal for that address

2. **Emergency Proposals**
   - Time-sensitive security fixes
   - Known team members proposing
   - Community pre-discussion
   - Clear benefit to protocol

3. **Legitimate Delegation**
   - Token holders delegate to experts
   - Delegatee votes on their behalf
   - Normal governance participation

4. **Vote Aggregation**
   - Snapshot voting (off-chain)
   - Vote aggregators collecting community votes
   - Not malicious, just batched

### How to Distinguish

**Governance Attack Indicators:**
- Voting power appears suddenly (flash loan)
- Proposer benefits directly from proposal
- No community discussion beforehand
- Execution rushed (no timelock respect)
- Token returned immediately after
- New/unknown addresses

**Legitimate Governance:**
- Voting power accumulated over time
- Proposal discussed in forums/Discord
- Timelock delays respected
- Proposer has history of contribution
- Voting power retained after vote
- Known community members

## LLM Validation Context

### What to Send to LLM

```json
{
  "finding_type": "GOVERNANCE_ATTACK",
  "transaction": {
    "hash": "0x...",
    "value": "50000000000000000000000000",
    "gas_used": 2800000,
    "from": "0x123...",
    "to": "0x789...",
    "block_number": 12345678
  },
  "governance_analysis": {
    "voting_power_change": {
      "before": "0",
      "after": "67%",
      "duration_blocks": 1
    },
    "proposal_details": {
      "proposal_id": "BIP-18",
      "action": "Transfer treasury to proposer",
      "timelock_delay": 0,
      "execution_delay_blocks": 0
    },
    "token_flow": {
      "flash_loan_detected": true,
      "governance_token_acquired": "1000000",
      "tokens_returned": true,
      "time_held_seconds": 13
    }
  },
  "context": {
    "address_history": "new",
    "previous_proposals": 0,
    "community_discussion": false
  }
}
```

### Expected LLM Response

**Valid Governance Attack:**
```json
{
  "valid": true,
  "confidence": 95,
  "severity": "CRITICAL",
  "reason": "Classic flash loan governance attack: attacker borrowed funds, acquired 67% voting power, passed proposal to drain treasury, and returned tokens within single transaction block",
  "recommendation": "IMMEDIATE ACTION: Pause governance if possible. Investigate proposal BIP-18. Implement timelock delays and minimum token holding period for voting. Consider snapshot-based voting."
}
```

**False Positive (Legitimate Whale Vote):**
```json
{
  "valid": false,
  "confidence": 88,
  "severity": "FALSE_POSITIVE",
  "reason": "Large voting power is from long-term token holder (address active for 500+ days). Proposal was discussed in governance forums for 2 weeks before vote. Timelock delay properly implemented.",
  "recommendation": "No action needed. This is normal governance participation by known community member. Consider documenting large holder voting patterns to reduce future false positives."
}
```

**Suspicious but Uncertain:**
```json
{
  "valid": true,
  "confidence": 65,
  "severity": "MEDIUM",
  "reason": "Voting pattern shows coordination between multiple addresses voting identically, but addresses have legitimate history. Could be delegation or coordinated community voting rather than attack.",
  "recommendation": "Monitor proposal closely. Check if these addresses have publicly announced delegation relationships. Request community feedback on proposal before execution."
}
```

## Prevention & Mitigation

### Protocol-Level Protections

1. **Timelock Delays**
```solidity
contract SafeGovernance {
    uint256 public constant TIMELOCK_DELAY = 2 days;

    mapping(uint256 => uint256) public proposalExecutionTime;

    function propose(...) external returns (uint256) {
        uint256 proposalId = _createProposal(...);
        proposalExecutionTime[proposalId] = block.timestamp + TIMELOCK_DELAY;
        return proposalId;
    }

    function execute(uint256 proposalId) external {
        require(
            block.timestamp >= proposalExecutionTime[proposalId],
            "Timelock not expired"
        );
        _execute(proposalId);
    }
}
```

2. **Vote Delegation Lock**
```solidity
uint256 public constant MIN_HOLD_TIME = 1 days;

mapping(address => uint256) public delegationTime;

function delegate(address delegatee) external {
    delegationTime[msg.sender] = block.timestamp;
    _delegate(msg.sender, delegatee);
}

function castVote(uint256 proposalId, uint8 support) external {
    require(
        block.timestamp >= delegationTime[msg.sender] + MIN_HOLD_TIME,
        "Must hold voting power for minimum time"
    );
    _castVote(proposalId, support);
}
```

3. **Quorum Requirements**
```solidity
function execute(uint256 proposalId) external {
    Proposal storage proposal = proposals[proposalId];

    require(proposal.forVotes > proposal.againstVotes, "Proposal failed");
    require(
        proposal.forVotes >= (totalSupply() * quorumNumerator) / 100,
        "Quorum not reached"
    );

    _execute(proposal);
}
```

4. **Voting Power Snapshots**
```solidity
// Use historical balance, not current
function getVotingPower(address account, uint256 blockNumber)
    external
    view
    returns (uint256)
{
    return balanceOfAt(account, blockNumber);
}

// Prevents flash loan attacks
function propose(...) external returns (uint256) {
    uint256 snapshotBlock = block.number - 1;
    require(
        getVotingPower(msg.sender, snapshotBlock) >= proposalThreshold,
        "Insufficient voting power at snapshot"
    );
    // ...
}
```

## Impact Analysis

### Protocol Impact
- **Treasury Loss**: Direct fund drainage
- **Parameter Manipulation**: Malicious config changes
- **Trust Damage**: Community loses faith in governance
- **Legal Risk**: Regulatory scrutiny

### Token Impact
- **Price Crash**: Attack causes sell-off
- **Liquidity Issues**: Large swaps impact market
- **Holder Exodus**: Users lose trust, sell tokens

### Governance Impact
- **Process Paralysis**: Fear prevents future proposals
- **Centralization**: Move to manual admin control
- **Participation Drop**: Users stop voting

## Governance Attack vs Other Attacks

| Attack Type | Token Acquisition | Voting | Execution | Goal |
|-------------|------------------|--------|-----------|------|
| **Governance** | Flash loan/accumulation | Yes | Malicious proposal | Treasury/control |
| **Flash Loan** | Flash loan | No | DeFi manipulation | Arbitrage profit |
| **Sybil** | Distributed | Yes | Looks organic | Influence votes |
| **Insider** | Already held | Yes | Self-dealing | Personal gain |

## Summary for RAG

**Key Detection Signals:**
- Flash loan + governance token swap
- Voting power spike (0% → >33% → 0%)
- Proposal execution in same block as vote
- Treasury funds transferred to proposer
- New address with massive votes

**Validation Questions:**
1. Was voting power acquired via flash loan?
2. Was there community discussion before proposal?
3. Was timelock delay respected?
4. Does proposer benefit directly from proposal?
5. Does address have governance history?

**Confidence Levels:**
- 90%+: Flash loan + vote + execute + drain (clear attack)
- 75-90%: Suspicious voting pattern with large stake
- 60-75%: Coordinated voting, unclear if malicious
- <60%: Likely legitimate large holder activity

**Action Recommendations:**
- **CRITICAL**: Pause governance, investigate proposal, contact team
- **HIGH**: Monitor proposal closely, delay execution, verify legitimacy
- **MEDIUM**: Track voting patterns, engage community discussion
- **LOW**: Document for future reference

**Prevention Priority:**
1. Timelock delays (most critical)
2. Minimum token holding period
3. Snapshot-based voting power
4. Quorum requirements
5. Multi-sig execution for large proposals
