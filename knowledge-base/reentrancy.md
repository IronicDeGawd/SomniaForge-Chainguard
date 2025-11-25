# Reentrancy Vulnerability Knowledge Base

## Definition

Reentrancy is a critical smart contract vulnerability where an external contract call allows an attacker to recursively call back into the original function before the first invocation completes, potentially draining funds or manipulating state.

## Vulnerability Pattern

### Classic Pattern
```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient balance");
    
    // VULNERABLE: External call before state update
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    
    // State update happens AFTER external call
    balances[msg.sender] -= amount;
}
```

### Why It's Vulnerable
1. **External call** (`msg.sender.call`) transfers control to attacker
2. **Attacker's contract** can call `withdraw()` again
3. **Balance check** still passes (not updated yet)
4. **Recursive calls** drain the contract before balance updates

## Attack Scenario

```solidity
// Attacker Contract
contract Attacker {
    VulnerableContract target;
    
    constructor(address _target) {
        target = VulnerableContract(_target);
    }
    
    function attack() external payable {
        target.deposit{value: 1 ether}();
        target.withdraw(1 ether);
    }
    
    // Fallback function - called when receiving ETH
    receive() external payable {
        if (address(target).balance >= 1 ether) {
            target.withdraw(1 ether); // Recursive call!
        }
    }
}
```

**Attack Flow**:
1. Attacker deposits 1 ETH
2. Calls `withdraw(1 ETH)`
3. Contract sends 1 ETH to attacker
4. Attacker's `receive()` is triggered
5. Before balance update, attacker calls `withdraw()` again
6. Balance check passes (still shows 1 ETH)
7. Repeat until contract is drained

## Detection Patterns

### Pattern 1: External Call Before State Update
**Bytecode Signature**:
- `CALL` opcode (0xF1) before `SSTORE` (0x55)
- Within same function scope
- Window: 50 instructions

**AST Pattern**:
```javascript
{
  externalCallIndex: number,
  stateUpdateIndex: number,
  vulnerable: externalCallIndex < stateUpdateIndex
}
```

### Pattern 2: Low-Level Calls
**Indicators**:
- `.call{value: ...}("")`
- `.send(...)`
- `.transfer(...)`
- `.delegatecall(...)`

**Note**: `.transfer()` and `.send()` have 2300 gas limit, making reentrancy harder but not impossible.

### Pattern 3: Missing Reentrancy Guards
**Check for absence of**:
- `nonReentrant` modifier
- `ReentrancyGuard` from OpenZeppelin
- Manual lock variables

## Real-World Examples

### The DAO Hack (2016)
**Loss**: $60 million (3.6M ETH)

**Vulnerable Code**:
```solidity
function splitDAO(uint _proposalID, address _newCurator) {
    // ... validation ...
    
    // VULNERABLE: Transfer before state update
    if (balances[msg.sender] > 0) {
        if (!msg.sender.call.value(balances[msg.sender])()) {
            throw;
        }
    }
    
    // State update after external call
    balances[msg.sender] = 0;
}
```

**Impact**: Led to Ethereum hard fork (ETH/ETC split)

### Cream Finance Hack (2021)
**Loss**: $130 million

**Vulnerability**: Reentrancy in flash loan callback
```solidity
function flashLoan(uint amount) external {
    uint balanceBefore = token.balanceOf(address(this));
    
    // VULNERABLE: External call to untrusted contract
    IFlashLoanReceiver(msg.sender).executeOperation(amount);
    
    // Check after callback
    require(token.balanceOf(address(this)) >= balanceBefore);
}
```

### Uniswap V1 (Mitigated)
**Potential Vulnerability**: ERC777 tokens with hooks
```solidity
function tokenToEthSwap(uint tokens) external {
    // Transfer tokens from user
    token.transferFrom(msg.sender, address(this), tokens); // ERC777 hook!
    
    // Calculate ETH to send
    uint ethAmount = getOutputAmount(tokens);
    
    // Send ETH
    msg.sender.transfer(ethAmount);
}
```

**Mitigation**: Checks-Effects-Interactions pattern

## Secure Patterns

### Pattern 1: Checks-Effects-Interactions
```solidity
function withdraw(uint256 amount) external {
    // CHECKS
    require(balances[msg.sender] >= amount, "Insufficient balance");
    
    // EFFECTS (update state FIRST)
    balances[msg.sender] -= amount;
    
    // INTERACTIONS (external calls LAST)
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

### Pattern 2: ReentrancyGuard
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    mapping(address => uint256) public balances;
    
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount);
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        
        balances[msg.sender] -= amount;
    }
}
```

### Pattern 3: Pull Over Push
```solidity
// Instead of pushing ETH to users
mapping(address => uint256) public pendingWithdrawals;

function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0; // Update first
    
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
```

## Validation Criteria

### True Positive Indicators
1. ✅ External call before state update
2. ✅ No reentrancy guard
3. ✅ Modifies critical state (balances, ownership)
4. ✅ Uses low-level calls (`.call`, `.delegatecall`)
5. ✅ Public/external visibility

### False Positive Indicators
1. ❌ Has `nonReentrant` modifier
2. ❌ Uses `ReentrancyGuard`
3. ❌ State updated before external call
4. ❌ Only view/pure functions called
5. ❌ Uses `.transfer()` or `.send()` with no other calls
6. ❌ Internal/private function
7. ❌ No state modifications

### Edge Cases
**Partial Protection**:
```solidity
// STILL VULNERABLE despite guard on one function
function withdraw() external nonReentrant {
    _withdraw(msg.sender);
}

function emergencyWithdraw() external {
    _withdraw(msg.sender); // No guard!
}

function _withdraw(address user) internal {
    // Vulnerable logic
}
```

**Cross-Function Reentrancy**:
```solidity
function withdraw() external nonReentrant {
    balances[msg.sender] = 0;
    msg.sender.call{value: balances[msg.sender]}("");
}

function transfer(address to, uint amount) external {
    // Attacker can call this during withdraw
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
```

## Severity Assessment

### CRITICAL
- Direct fund loss possible
- No reentrancy protection
- Handles native ETH or valuable tokens
- Public/external function
- **Confidence**: 95%+

### HIGH
- State manipulation possible
- Partial protection (e.g., only one function guarded)
- Handles tokens with hooks (ERC777, ERC1155)
- **Confidence**: 80-95%

### MEDIUM
- Theoretical vulnerability
- Requires specific conditions
- Limited impact
- **Confidence**: 60-80%

### LOW / FALSE POSITIVE
- Has proper guards
- Follows CEI pattern
- No state modifications
- **Confidence**: <60%

## LLM Validation Prompts

### Prompt Template
```
You are a smart contract security auditor specializing in reentrancy attacks.

FINDING:
Type: Reentrancy
Function: {function_name}
Line: {line_number}

CODE SNIPPET:
{code_snippet}

ANALYSIS:
External call on line {call_line} occurs before state update on line {state_line}.

CONTEXT:
- Function visibility: {visibility}
- Modifiers: {modifiers}
- Handles value: {handles_value}

QUESTION:
Is this a true reentrancy vulnerability?

Check for:
1. ReentrancyGuard or nonReentrant modifier
2. Checks-Effects-Interactions pattern violations
3. Any other protective measures
4. Cross-function reentrancy risks

Respond in JSON:
{
  "valid": true/false,
  "confidence": 0-100,
  "severity": "CRITICAL/HIGH/MEDIUM/LOW/FALSE_POSITIVE",
  "reason": "one sentence explanation",
  "recommendation": "specific fix"
}
```

### Example Validation

**Input**:
```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] -= amount;
}
```

**Expected Output**:
```json
{
  "valid": true,
  "confidence": 95,
  "severity": "CRITICAL",
  "reason": "External call before state update with no reentrancy guard allows recursive calls to drain funds",
  "recommendation": "Move state update before external call or add nonReentrant modifier"
}
```

**Input** (Protected):
```solidity
function withdraw(uint256 amount) external nonReentrant {
    require(balances[msg.sender] >= amount);
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] -= amount;
}
```

**Expected Output**:
```json
{
  "valid": false,
  "confidence": 98,
  "severity": "FALSE_POSITIVE",
  "reason": "Function has nonReentrant modifier which prevents reentrancy attacks",
  "recommendation": "No action needed - properly protected"
}
```

## References

- [Consensys: Reentrancy](https://consensys.github.io/smart-contract-best-practices/attacks/reentrancy/)
- [SWC-107: Reentrancy](https://swcregistry.io/docs/SWC-107)
- [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard)
- [The DAO Hack Analysis](https://hackingdistributed.com/2016/06/18/analysis-of-the-dao-exploit/)
