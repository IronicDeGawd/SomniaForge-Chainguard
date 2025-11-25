# Unchecked External Call Vulnerability Knowledge Base

## Definition

Unchecked external call vulnerabilities occur when smart contracts use low-level calls (`.call()`, `.delegatecall()`, `.staticcall()`) without verifying the return value, potentially causing silent failures and unexpected behavior.

## Vulnerability Pattern

### Classic Pattern
```solidity
function sendPayment(address recipient, uint256 amount) external {
    // VULNERABLE: Return value not checked
    recipient.call{value: amount}("");
    
    // Contract assumes payment succeeded
    emit PaymentSent(recipient, amount);
}
```

### Why It's Vulnerable
1. **Low-level calls** return `(bool success, bytes memory data)`
2. **Success not checked** - failure goes unnoticed
3. **Silent failures** - contract continues execution
4. **State inconsistency** - events emitted despite failure

## Low-Level Call Types

### .call() - External Function Call
```solidity
// Returns (bool success, bytes memory returnData)
(bool success, bytes memory data) = target.call{value: 1 ether}(
    abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
);

// VULNERABLE if not checked
target.call{value: 1 ether}(""); // Return value ignored
```

### .delegatecall() - Execute in Current Context
```solidity
// VULNERABLE: Critical for upgradeable contracts
(bool success, ) = implementation.delegatecall(msg.data);
// If not checked, upgrade could fail silently
```

### .staticcall() - Read-Only Call
```solidity
// Less critical but still important
(bool success, bytes memory data) = oracle.staticcall(
    abi.encodeWithSignature("getPrice()")
);
// VULNERABLE: Could use stale/default price if call fails
```

## Detection Patterns

### Pattern 1: Return Value Not Captured
```solidity
// VULNERABLE: Return value discarded
target.call{value: amount}("");
target.delegatecall(data);
```

### Pattern 2: Return Value Captured But Not Checked
```solidity
// VULNERABLE: success variable unused
(bool success, ) = target.call{value: amount}("");
// No require(success) or if(success) check
```

### Pattern 3: Only Data Checked, Not Success
```solidity
// VULNERABLE: Checks data but not success
(bool success, bytes memory data) = target.call("");
require(data.length > 0); // Wrong! Should check success first
```

## Bytecode Detection

**Opcode Sequence**:
```
CALL (0xF1)
POP  (0x50)  // Return value popped without checking
```

**Safe Pattern**:
```
CALL (0xF1)
ISZERO (0x15)  // Check if success == false
PUSH1 (0x60)
JUMPI (0x57)   // Jump to revert if failed
```

## Real-World Examples

### King of the Ether (2016)
**Impact**: Contract became stuck

**Vulnerable Code**:
```solidity
function claimThrone(string memory name) external payable {
    require(msg.value > currentBid);
    
    // VULNERABLE: If previous king's fallback reverts,
    // this call fails but contract continues
    previousKing.call{value: currentBid}("");
    
    currentKing = msg.sender;
    currentBid = msg.value;
}
```

**Attack**: Attacker's contract reverts on receive, blocking all future claims.

### Ethernaut Level 9 - King
**Vulnerability**: Same as above

**Exploit**:
```solidity
contract AttackKing {
    constructor(address payable target) payable {
        target.call{value: msg.value}("");
    }
    
    // Revert on receive - breaks the game
    receive() external payable {
        revert("I'm the eternal king!");
    }
}
```

### Real DeFi Protocol (Anonymous)
**Loss**: $2M in stuck funds

**Vulnerable Code**:
```solidity
function distributeFees(address[] memory recipients) external {
    uint256 feePerRecipient = totalFees / recipients.length;
    
    for (uint i = 0; i < recipients.length; i++) {
        // VULNERABLE: If one fails, others don't get paid
        recipients[i].call{value: feePerRecipient}("");
    }
    
    totalFees = 0; // Fees marked as distributed even if calls failed!
}
```

## Secure Patterns

### Pattern 1: Check Success with require()
```solidity
function sendPayment(address recipient, uint256 amount) external {
    (bool success, ) = recipient.call{value: amount}("");
    require(success, "Payment failed");
}
```

### Pattern 2: Check Success with if/else
```solidity
function sendPayment(address recipient, uint256 amount) external {
    (bool success, ) = recipient.call{value: amount}("");
    
    if (!success) {
        // Handle failure gracefully
        pendingWithdrawals[recipient] += amount;
        emit PaymentQueued(recipient, amount);
    } else {
        emit PaymentSent(recipient, amount);
    }
}
```

### Pattern 3: Use SafeCall Library
```solidity
library SafeCall {
    function safeCall(
        address target,
        uint256 value,
        bytes memory data
    ) internal returns (bool) {
        (bool success, ) = target.call{value: value}(data);
        require(success, "Call failed");
        return success;
    }
}

// Usage
SafeCall.safeCall(recipient, amount, "");
```

### Pattern 4: Pull Over Push Pattern
```solidity
// Instead of pushing payments
mapping(address => uint256) public pendingWithdrawals;

function withdraw() external {
    uint256 amount = pendingWithdrawals[msg.sender];
    require(amount > 0, "Nothing to withdraw");
    
    pendingWithdrawals[msg.sender] = 0;
    
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Withdrawal failed");
}
```

### Pattern 5: Use transfer() or send() Appropriately
```solidity
// transfer() - reverts on failure (2300 gas limit)
recipient.transfer(amount); // Automatically checked

// send() - returns bool (2300 gas limit)
bool success = recipient.send(amount);
require(success, "Send failed");
```

**Note**: `transfer()` and `send()` have 2300 gas limit, which may not be enough for complex fallback functions.

## Validation Criteria

### True Positive Indicators
1. ✅ Uses `.call()`, `.delegatecall()`, or `.staticcall()`
2. ✅ Return value not captured: `target.call("")`
3. ✅ Success bool captured but never checked
4. ✅ No `require(success)` or `if (!success)` after call
5. ✅ Critical operation (fund transfer, state change)

### False Positive Indicators
1. ❌ Has `require(success)` check
2. ❌ Has `if (!success) { revert/handle }` check
3. ❌ Uses `transfer()` or `send()` with check
4. ❌ Uses SafeCall or similar library
5. ❌ Non-critical operation (logging, optional feature)
6. ❌ Success checked in modifier or internal function

### Severity Assessment

**CRITICAL** (Score: 10):
- `delegatecall` in proxy/upgrade pattern unchecked
- Fund transfers without success check
- State changes dependent on call success

**HIGH** (Score: 7-9):
- Payment distribution without checks
- Token transfers via low-level calls
- Critical external contract interactions

**MEDIUM** (Score: 4-6):
- Optional features using unchecked calls
- Calls with fallback handling
- Non-financial operations

**LOW** (Score: 1-3):
- View function calls
- Logging/event emission
- Already has partial protection

## Edge Cases

### Edge Case 1: Checked in Modifier
```solidity
modifier checkSuccess(address target, bytes memory data) {
    (bool success, ) = target.call(data);
    require(success);
    _;
}

function execute(address target, bytes memory data) 
    external 
    checkSuccess(target, data) 
{
    // Success already checked in modifier - FALSE POSITIVE
}
```

### Edge Case 2: Assembly Check
```solidity
function execute(address target) external {
    bool success;
    assembly {
        success := call(gas(), target, 0, 0, 0, 0, 0)
    }
    require(success); // Checked in assembly - FALSE POSITIVE
}
```

### Edge Case 3: Try/Catch (Solidity 0.6+)
```solidity
try target.someFunction() {
    // Success
} catch {
    // Failure handled - FALSE POSITIVE
}
```

## LLM Validation Prompts

### Prompt Template
```
You are a smart contract security auditor specializing in external call safety.

FINDING:
Type: Unchecked External Call
Function: {function_name}
Line: {line_number}

CODE SNIPPET:
{code_snippet}

ANALYSIS:
Low-level call on line {call_line} does not check return value.

CONTEXT:
- Call type: {call_type}
- Value transferred: {has_value}
- Operation criticality: {criticality}

QUESTION:
Is this a true unchecked call vulnerability?

Check for:
1. Success boolean checked with require() or if statement
2. Use of SafeCall or similar library
3. Try/catch block handling
4. Success checked in modifier or helper function
5. Whether operation is actually critical

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

**Input** (Vulnerable):
```solidity
function sendReward(address winner, uint256 amount) external {
    winner.call{value: amount}("");
    emit RewardSent(winner, amount);
}
```

**Expected Output**:
```json
{
  "valid": true,
  "confidence": 95,
  "severity": "HIGH",
  "reason": "Payment sent without checking success, could silently fail leaving contract in inconsistent state",
  "recommendation": "Add require check: (bool success, ) = winner.call{value: amount}(\"\"); require(success, \"Payment failed\");"
}
```

**Input** (Protected):
```solidity
function sendReward(address winner, uint256 amount) external {
    (bool success, ) = winner.call{value: amount}("");
    require(success, "Payment failed");
    emit RewardSent(winner, amount);
}
```

**Expected Output**:
```json
{
  "valid": false,
  "confidence": 99,
  "severity": "FALSE_POSITIVE",
  "reason": "Call success is properly checked with require statement",
  "recommendation": "No action needed - properly protected"
}
```

**Input** (Edge Case - Graceful Handling):
```solidity
function sendReward(address winner, uint256 amount) external {
    (bool success, ) = winner.call{value: amount}("");
    
    if (!success) {
        pendingRewards[winner] += amount;
        emit RewardQueued(winner, amount);
    } else {
        emit RewardSent(winner, amount);
    }
}
```

**Expected Output**:
```json
{
  "valid": false,
  "confidence": 98,
  "severity": "FALSE_POSITIVE",
  "reason": "Call failure is gracefully handled by queuing payment for later withdrawal",
  "recommendation": "No action needed - failure properly handled with fallback mechanism"
}
```

## Common Pitfalls

### Pitfall 1: Checking Data Instead of Success
```solidity
// WRONG
(bool success, bytes memory data) = target.call("");
require(data.length > 0); // Doesn't check success!

// CORRECT
require(success && data.length > 0);
```

### Pitfall 2: Ignoring delegatecall Failures
```solidity
// CRITICAL VULNERABILITY in proxy
function upgrade(address newImpl) external {
    implementation = newImpl;
    newImpl.delegatecall(abi.encodeWithSignature("initialize()"));
    // If initialize fails, contract is in broken state!
}

// CORRECT
(bool success, ) = newImpl.delegatecall(...);
require(success, "Initialization failed");
```

### Pitfall 3: Loop with Unchecked Calls
```solidity
// VULNERABLE: One failure doesn't stop loop
for (uint i = 0; i < recipients.length; i++) {
    recipients[i].call{value: amount}("");
}

// BETTER: Track failures
for (uint i = 0; i < recipients.length; i++) {
    (bool success, ) = recipients[i].call{value: amount}("");
    if (!success) {
        failedPayments[recipients[i]] += amount;
    }
}
```

## Gas Considerations

**transfer() vs call()**:
- `transfer()`: 2300 gas, reverts on failure
- `call()`: Forward all gas, returns bool

**Modern Best Practice**: Use `call()` with success check
```solidity
(bool success, ) = recipient.call{value: amount}("");
require(success, "Transfer failed");
```

**Why**: Some contracts need >2300 gas in fallback (e.g., multisigs, proxies)

## References

- [SWC-104: Unchecked Call Return Value](https://swcregistry.io/docs/SWC-104)
- [Consensys: Handle Errors in External Calls](https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/)
- [Solidity Docs: Error Handling](https://docs.soliditylang.org/en/latest/control-structures.html#error-handling-assert-require-revert-and-exceptions)
