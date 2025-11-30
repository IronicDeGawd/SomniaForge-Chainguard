# ChainGuard Test Environment - Demo Guide

Step-by-step walkthrough for testing ChainGuard's behavioral attack detection using **Hardhat deployment**.

## Prerequisites

- Node.js 18+
- Access to Somnia Testnet
- **At least 200 STT** in `PRIVATE_KEY_1` account for deployment + funding
- ChainGuard backend running

---

## Important: Deployment Account

**The deployment script uses `PRIVATE_KEY_1` from your `.env` file.**

### Fund This Account First

1. Check which address corresponds to `PRIVATE_KEY_1`:
   ```bash
   cd test-environment
   npm start
   # Look for "Wallet 1 (0x...)" address
   ```

2. **Send 200+ STT** to this address from Somnia faucet
   - 150 STT for contract funding (100 + 50)
   - 50 STT for deployment gas + safety margin

---

## Demo 1: One-Command Deployment (Recommended)

**Time**: ~5 minutes
**Tests**: All 8 behavioral patterns
**Method**: Hardhat automated deployment

### Step 1: Setup Environment

```bash
# Navigate to test environment
cd test-environment

# Install dependencies (if not done)
npm install

# Copy environment template
cp .env.example .env
```

### Step 2: Add Private Key

Edit `.env` and ensure `PRIVATE_KEY_1` is set:
```env
PRIVATE_KEY_1=0xYourPrivateKeyHere
```

> **⚠️ CRITICAL**: Ensure `PRIVATE_KEY_1` wallet has **200+ STT** before deploying!

### Step 3: Deploy All Contracts

```bash
npm run deploy
```

Expected output:
```
🚀 ChainGuard Test Contracts Deployment

📍 Deploying from address: 0x1234...
💰 Account balance: 200.5 STT

📦 [1/6] Deploying GeneralTest...
   ✅ GeneralTest deployed: 0x...

📦 [2/6] Deploying GovernanceTest...
   ✅ GovernanceTest deployed: 0x...

📦 [3/6] Deploying FlashLoanProvider...
   ✅ FlashLoanProvider deployed: 0x...

📦 [4/6] Deploying FlashLoanAttacker...
   Constructor args: FlashLoanProvider, GovernanceTest
   ✅ FlashLoanAttacker deployed: 0x...

📦 [5/6] Deploying MixerSimulator...
   ✅ MixerSimulator deployed: 0x...

📦 [6/6] Deploying ProgressiveAttacker...
   Constructor args: GeneralTest (target)
   ✅ ProgressiveAttacker deployed: 0x...

💸 Auto-funding contracts...

   Funding FlashLoanProvider with 100 STT...
   ✅ FlashLoanProvider funded with 100 STT

   Funding GovernanceTest treasury with 50 STT...
   ✅ GovernanceTest treasury funded with 50 STT

📝 Updating .env file...
   ✅ .env file updated with deployed addresses

═══════════════════════════════════════════════════════════
✅ DEPLOYMENT COMPLETE

📋 Deployed Contracts:

   GeneralTest:            0x1234...
   GovernanceTest:         0x5678...
   FlashLoanProvider:      0x9abc...
   FlashLoanAttacker:      0xdef0...
   MixerSimulator:         0x1111...
   ProgressiveAttacker:    0x2222...

💰 Contract Funding:
   FlashLoanProvider:      100 STT
   GovernanceTest:         50 STT

📍 Deployer Balance After:
    48.3 STT

💸 Total Spent:
    152.2 STT

🎯 Next Steps:
   1. Verify .env file has been updated
   2. Add contract addresses to ChainGuard frontend manually
   3. Run tests:
      npm start           (interactive)
      npm run test:basic  (automated basic tests)
      npm run test:advanced (automated advanced tests)
═══════════════════════════════════════════════════════════
```

### Step 4: Verify Deployment

Check that `.env` was automatically updated:
```bash
cat .env | grep ADDRESS
```

You should see all 6 contract addresses filled in.

### Step 5: Add Contracts to ChainGuard Frontend

1. Start frontend (if not running):
   ```bash
   cd ../frontend
   npm run dev
   # Visit http://localhost:8080
   ```

2. Connect wallet via frontend
3. Navigate to "Monitor" page
4. Click "Add Contract" for each deployed address:
   - **GeneralTest** (for basic tests 1-6)
   - **GovernanceTest** (for governance attack)
   - **FlashLoanProvider** (for governance attack)
   - **FlashLoanAttacker** (for governance attack)
   - **MixerSimulator** (for suspicious patterns)
   - **ProgressiveAttacker** (for suspicious patterns)

### Step 6: Run Tests

```bash
# Interactive menu (basic tests)
npm start

# Automated basic tests
npm run test:basic

# Automated advanced tests (governance + suspicious patterns)
npm run test:advanced
```

### Step 7: Watch Alerts in Real-Time

Alerts will appear in the ChainGuard frontend dashboard as tests execute!

---

## Running Tests

### Interactive Test Menu (Basic Patterns)

```bash
npm start
```

Menu:
```
╔════════════════════════════════════════╗
║   ChainGuard Heuristics Test Suite    ║
╚════════════════════════════════════════╝

Behavioral Heuristics Tests:
  [1] High Value Transfer (>10 STT)
  [2] High Frequency Bot (6 rapid txs)
  [3] Flash Loan Pattern (High Value + High Gas)
  [4] Failed High Gas Transaction
  [5] Spam / State Bloat (High Gas + 0 Value)
  [6] DDoS Simulation (12 rapid txs to contract)

  [r] Reload / Check Balances
  [q] Quit

Select an option >
```

Press 1-6 to trigger each test. Watch alerts appear in frontend!

### Automated Basic Tests

```bash
npm run test:basic
```

Runs all 6 basic tests automatically.

### Automated Advanced Tests

```bash
npm run test:advanced
```

Runs governance attack and suspicious pattern tests.

Expected output:
```
🚀 ChainGuard Advanced Heuristics Test Suite

🧪 Test 1: Governance Attack (Flash Loan + Voting Spike)

   Step 1: Funding governance treasury...
   ✅ Treasury funded: 0xabc...

   Step 2: Funding flash loan pool...
   ✅ Pool funded: 0xdef...

   Step 3: Executing governance attack...
   ⚠️  Expected Detection: GOVERNANCE_ATTACK (CRITICAL)
   ✅ Attack executed: 0x123...

🧪 Test 2: Suspicious Pattern (Mixer → New Address → Attacks)

   Step 1: Depositing to mixer...
   ✅ Deposited to mixer: 0x456...

   Step 2: Withdrawing to fresh address...
   ✅ Withdrawn to attacker: 0x789...
   ⚠️  Expected Detection: SUSPICIOUS_PATTERN

   Step 3: Simulating failed reconnaissance attempts...
   ✅ Failed attempts: 0xabc...
   ⚠️  Expected Detection: SUSPICIOUS_PATTERN (high failure rate)

✅ Advanced Tests Completed
```

---

## Expected Detection Outputs

### Backend Logs

```bash
cd ../backend
npm run dev

# Watch for:
✅ HIGH_VALUE_TRANSFER detected
   Address: 0x1234...
   Value: 11 STT
   Severity: MEDIUM

✅ FLASH_LOAN_ATTACK detected
   Risk Score: 85
   Severity: HIGH
   Factors: High value + High gas

⚠️  CRITICAL: GOVERNANCE_ATTACK detected
   Flash loan detected: 50 STT
   Voting power spike: 0% → 67%
   Proposal created + voted same block
   Severity: CRITICAL
```

### Frontend Dashboard

Real-time alert cards will appear showing:
- Alert type (FLASH_LOAN_ATTACK, etc.)
- Severity badge (CRITICAL, HIGH, MEDIUM, LOW)
- Contract address
- Transaction hash (clickable → block explorer)
- LLM validation reasoning
- Confidence score
- Recommended actions

---

## Troubleshooting

### "Insufficient funds for deployment"

**Solution**: Ensure `PRIVATE_KEY_1` wallet has 200+ STT before running `npm run deploy`

### "Error: contract not deployed"

**Solution**:
1. Check that `npm run deploy` completed successfully
2. Verify `.env` has all 6 contract addresses
3. Confirm contracts exist on block explorer

### "No alerts appearing in frontend"

**Solution**:
1. Check backend is running (`cd ../backend && npm run dev`)
2. Verify contracts were added to monitoring via frontend UI
3. Check SDS connection in backend logs: "Connected to SDS"
4. Ensure test transactions are actually being sent (check block explorer)

### "Advanced tests failing"

**Solution**:
1. Contracts were auto-funded during deployment
2. If you deployed manually, ensure:
   - FlashLoanProvider has 100 STT (call `deposit()` function)
   - GovernanceTest has 50 STT (send STT to contract address)

### "Cannot find module 'hardhat'"

**Solution**: Run `npm install` again to ensure Hardhat is installed

---

## Cost Breakdown

**Deployment via Hardhat** (using `PRIVATE_KEY_1`):

| Item | Amount (STT) |
|------|--------------|
| Contract Deployments | ~2 STT (gas) |
| FlashLoanProvider Funding | 100 STT |
| GovernanceTest Funding | 50 STT |
| **Total** | **~152 STT** |

**Recommended wallet balance**: 200 STT (includes safety margin)

---

## Quick Reference

### Commands

```bash
# Deploy all contracts (uses PRIVATE_KEY_1)
npm run deploy

# Compile contracts only
npm run compile

# Interactive basic tests
npm start

# Automated basic tests (1-6)
npm run test:basic

# Automated advanced tests (7-8)
npm run test:advanced
```

### Deployment Account

- **Uses**: `PRIVATE_KEY_1` from `.env`
- **Required Balance**: 200+ STT
- **Purpose**: Deploy 6 contracts + fund 2 contracts (150 STT total)

### Funded Contracts

After deployment, these contracts are automatically funded:
- **FlashLoanProvider**: 100 STT (for flash loan pool)
- **GovernanceTest**: 50 STT (for treasury attacks)

### Network Details

- **Network**: Somnia Testnet
- **RPC**: `https://dream-rpc.somnia.network`
- **Chain ID**: `50312`
- **Currency**: `STT`
- **Explorer**: `https://somnia-testnet.blockscout.com/`

---

## What You'll Test

### Basic Patterns (GeneralTest)
1. High Value Transfer (>10 STT)
2. High Frequency Bot (>5 tx/min)
3. Flash Loan Attack (High value + High gas)
4. Failed High Gas (High gas + Revert)
5. Spam / State Bloat (>1M gas + 0 value)
6. DDoS Attack (>10 tx/min to contract)

### Advanced Patterns (Multiple Contracts)
7. Governance Attack (Flash loan → Vote → Drain)
8. Suspicious Patterns (Mixer → Reconnaissance → Escalation)

---

## Next Steps After Demo

1. **Explore LLM Validation**: Set up N8N webhook for AI-powered analysis
2. **Custom Rules**: Modify detection thresholds in `backend/src/rules/engine.ts`
3. **Deploy to Production**: Use real contracts on Somnia mainnet
4. **Integrate**: Add ChainGuard monitoring to your DApp

---

**Need Help?** Check [README.md](README.md) for detailed documentation.
