# Access Control Vulnerability Knowledge Base

## Definition

Access control vulnerabilities occur when sensitive functions lack proper authorization checks, allowing unauthorized users to execute privileged operations like minting tokens, withdrawing funds, or modifying critical contract state.

## Vulnerability Pattern

### Classic Pattern
```solidity
contract Token {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    
    // VULNERABLE: No access control!
    function mint(address to, uint256 amount) external {
        balances[to] += amount;
        totalSupply += amount;
    }
    
    // VULNERABLE: Anyone can destroy the contract
    function destroy() external {
        selfdestruct(payable(msg.sender));
    }
}
```

### Why It's Vulnerable
1. **No authorization check** - any address can call
2. **Privileged operations** - minting, burning, ownership transfer
3. **No access modifiers** - missing `onlyOwner`, `onlyAdmin`, etc.

## Common Vulnerable Functions

### High-Risk Functions
```solidity
// Ownership
transferOwnership()
renounceOwnership()

// Token Operations
mint()
burn()
setMinter()

// Financial
withdraw()
withdrawFees()
emergencyWithdraw()

// Contract Control
pause()
unpause()
upgrade()
initialize()

// Configuration
setFee()
setPrice()
setOracle()
updateConfig()

// Destruction
selfdestruct()
destroy()
kill()
```

## Detection Patterns

### Pattern 1: Sensitive Keywords Without Modifiers
```javascript
const SENSITIVE_KEYWORDS = [
  'mint', 'burn', 'withdraw', 'transfer', 'pause',
  'upgrade', 'initialize', 'selfdestruct', 'destroy',
  'setOwner', 'setAdmin', 'setFee', 'setPrice'
];

const REQUIRED_MODIFIERS = [
  'onlyOwner', 'onlyAdmin', 'onlyRole',
  'requireAuth', 'authorized', 'onlyGovernance'
];

function isVulnerable(func) {
  const isSensitive = SENSITIVE_KEYWORDS.some(kw =>
    func.name.toLowerCase().includes(kw)
  );
  
  const hasModifier = REQUIRED_MODIFIERS.some(mod =>
    func.modifiers.includes(mod)
  );
  
  return isSensitive && !hasModifier && 
         (func.visibility === 'public' || func.visibility === 'external');
}
```

### Pattern 2: Missing require() Checks
```solidity
// VULNERABLE
function setPrice(uint256 newPrice) external {
    price = newPrice; // No authorization!
}

// SECURE
function setPrice(uint256 newPrice) external {
    require(msg.sender == owner, "Not authorized");
    price = newPrice;
}
```

### Pattern 3: Weak Authorization
```solidity
// VULNERABLE: Easily bypassed
function withdraw() external {
    require(msg.sender != address(0)); // Meaningless check
    payable(msg.sender).transfer(address(this).balance);
}

// VULNERABLE: Hardcoded address
function setOwner(address newOwner) external {
    require(msg.sender == 0x1234...); // What if key is lost?
    owner = newOwner;
}
```

## Real-World Examples

### Parity Wallet Hack (2017)
**Loss**: $150 million (frozen)

**Vulnerable Code**:
```solidity
contract WalletLibrary {
    address public owner;
    
    // VULNERABLE: No access control on initialization
    function initWallet(address _owner) external {
        owner = _owner;
    }
    
    // Anyone could become owner!
    function kill(address _to) external {
        require(msg.sender == owner);
        selfdestruct(payable(_to));
    }
}
```

**Attack**:
1. Attacker called `initWallet()` on library contract
2. Became owner of the library
3. Called `kill()` to destroy library
4. All wallets using this library became unusable

### Poly Network Hack (2021)
**Loss**: $611 million (returned)

**Vulnerability**: Missing access control on cross-chain message verification
```solidity
// Simplified version
function executeTransaction(bytes memory data) external {
    // VULNERABLE: No verification of caller
    (bool success, ) = target.call(data);
    require(success);
}
```

### Uranium Finance (2021)
**Loss**: $50 million

**Vulnerability**: Missing migration access control
```solidity
function migrate() external {
    // VULNERABLE: Anyone could trigger migration
    // to malicious contract
    token.transfer(migrator, balance);
}
```

## Secure Patterns

### Pattern 1: OpenZeppelin Ownable
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is Ownable {
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
}
```

### Pattern 2: Role-Based Access Control (RBAC)
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Vault is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
}
```

### Pattern 3: Multi-Signature
```solidity
contract MultiSig {
    address[] public owners;
    uint256 public required;
    
    mapping(uint256 => mapping(address => bool)) public confirmations;
    
    modifier onlyOwner() {
        require(isOwner(msg.sender), "Not owner");
        _;
    }
    
    function executeTransaction(uint256 txId) external {
        require(isConfirmed(txId), "Not enough confirmations");
        // Execute...
    }
}
```

### Pattern 4: Timelock
```solidity
contract Timelock {
    uint256 public constant DELAY = 2 days;
    mapping(bytes32 => uint256) public queuedTransactions;
    
    function queueTransaction(address target, bytes memory data) 
        external 
        onlyOwner 
    {
        bytes32 txHash = keccak256(abi.encode(target, data));
        queuedTransactions[txHash] = block.timestamp + DELAY;
    }
    
    function executeTransaction(address target, bytes memory data) 
        external 
        onlyOwner 
    {
        bytes32 txHash = keccak256(abi.encode(target, data));
        require(
            queuedTransactions[txHash] != 0 &&
            queuedTransactions[txHash] <= block.timestamp,
            "Transaction not ready"
        );
        
        (bool success, ) = target.call(data);
        require(success);
    }
}
```

## Validation Criteria

### True Positive Indicators
1. ✅ Function name contains sensitive keywords
2. ✅ Public or external visibility
3. ✅ No access control modifiers
4. ✅ No `require(msg.sender == ...)` checks
5. ✅ Modifies critical state or transfers value
6. ✅ Not a view/pure function

### False Positive Indicators
1. ❌ Has `onlyOwner` or similar modifier
2. ❌ Has `require(msg.sender == owner)` check
3. ❌ Uses AccessControl with role checks
4. ❌ Internal or private visibility
5. ❌ View or pure function (read-only)
6. ❌ Only emits events (no state changes)

### Severity Factors

**CRITICAL** (Score: 10):
- `selfdestruct` / `destroy` without protection
- Ownership transfer without checks
- Unrestricted minting of valuable tokens
- Direct fund withdrawal

**HIGH** (Score: 7-9):
- Minting/burning without checks
- Pause/unpause without protection
- Fee/price modification
- Upgrade functions

**MEDIUM** (Score: 4-6):
- Configuration changes
- Non-critical state modifications
- Requires additional conditions to exploit

**LOW** (Score: 1-3):
- Limited impact functions
- Already has partial protection
- Requires privileged position

## LLM Validation Prompts

### Prompt Template
```
You are a smart contract security auditor specializing in access control.

FINDING:
Type: Missing Access Control
Function: {function_name}
Line: {line_number}

CODE SNIPPET:
{code_snippet}

ANALYSIS:
Function '{function_name}' performs sensitive operation but lacks access control.

CONTEXT:
- Visibility: {visibility}
- Modifiers: {modifiers}
- Operations: {operations}
- State changes: {state_changes}

QUESTION:
Is this a true access control vulnerability?

Check for:
1. Presence of access control modifiers (onlyOwner, onlyRole, etc.)
2. Manual authorization checks (require statements)
3. Whether function is actually sensitive
4. Alternative protection mechanisms

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
function mint(address to, uint256 amount) external {
    totalSupply += amount;
    balances[to] += amount;
}
```

**Expected Output**:
```json
{
  "valid": true,
  "confidence": 98,
  "severity": "CRITICAL",
  "reason": "Public mint function with no access control allows anyone to create unlimited tokens",
  "recommendation": "Add onlyOwner modifier or implement role-based access control"
}
```

**Input** (Protected):
```solidity
function mint(address to, uint256 amount) external onlyOwner {
    totalSupply += amount;
    balances[to] += amount;
}
```

**Expected Output**:
```json
{
  "valid": false,
  "confidence": 99,
  "severity": "FALSE_POSITIVE",
  "reason": "Function has onlyOwner modifier providing proper access control",
  "recommendation": "No action needed - properly protected"
}
```

**Input** (Edge Case):
```solidity
function setPrice(uint256 newPrice) external {
    require(newPrice > 0, "Invalid price");
    price = newPrice;
}
```

**Expected Output**:
```json
{
  "valid": true,
  "confidence": 90,
  "severity": "HIGH",
  "reason": "Price setter has input validation but no authorization check, allowing anyone to manipulate pricing",
  "recommendation": "Add require(msg.sender == owner) or use onlyOwner modifier"
}
```

## Common Pitfalls

### Pitfall 1: Constructor vs Initializer
```solidity
// VULNERABLE: Initializer without access control
contract Proxy {
    address public owner;
    
    function initialize(address _owner) external {
        owner = _owner; // Can be called by anyone!
    }
}

// SECURE: Protected initializer
function initialize(address _owner) external {
    require(owner == address(0), "Already initialized");
    owner = _owner;
}
```

### Pitfall 2: Delegatecall to User Input
```solidity
// VULNERABLE
function execute(address target, bytes memory data) external {
    target.delegatecall(data); // Anyone can execute arbitrary code!
}

// SECURE
function execute(address target, bytes memory data) external onlyOwner {
    require(isWhitelisted(target), "Target not allowed");
    target.delegatecall(data);
}
```

### Pitfall 3: Modifier Ordering
```solidity
// WRONG: Modifier after function body
function withdraw() external {
    payable(msg.sender).transfer(balance);
} onlyOwner // This doesn't work!

// CORRECT
function withdraw() external onlyOwner {
    payable(msg.sender).transfer(balance);
}
```

## References

- [SWC-105: Unprotected Ether Withdrawal](https://swcregistry.io/docs/SWC-105)
- [SWC-106: Unprotected SELFDESTRUCT](https://swcregistry.io/docs/SWC-106)
- [OpenZeppelin Access Control](https://docs.openzeppelin.com/contracts/4.x/access-control)
- [Parity Wallet Hack Analysis](https://blog.openzeppelin.com/on-the-parity-wallet-multisig-hack-405a8c12e8f7/)
