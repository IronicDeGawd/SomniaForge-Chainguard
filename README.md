# ChainGuard - Behavioral Smart Contract Security Monitor

Real-time blockchain security monitoring platform powered by **Somnia Data Streams (SDS)** and **AI validation**. ChainGuard detects malicious transaction patterns through behavioral analysis and validates findings using LLM-powered reasoning.

> **Important**: ChainGuard performs **behavioral transaction analysis**, not static code analysis. We detect attacks by analyzing transaction patterns, gas usage, value transfers, and runtime behavior.

## 🎯 What We Detect

ChainGuard monitors for **8 behavioral attack patterns**:

| Attack Type | Detection Method | Severity | Example |
|-------------|------------------|----------|---------|
| **Flash Loan Attacks** | Risk scoring (value + gas) | CRITICAL/HIGH | Cream Finance ($130M) |
| **Bot Activity** | >5 txs/min from sender | MEDIUM/HIGH | MEV bots, front-running |
| **DDoS Attacks** | >10 txs/min to contract | HIGH | Fomo3D block stuffing |
| **Spam/State Bloat** | >1M gas with 0 value | HIGH | ENS registry spam |
| **Governance Attacks** | Flash loan + voting spike | CRITICAL | Beanstalk ($182M) |
| **High-Value Transfers** | Large fund movements | MEDIUM | Whale activity |
| **Failed High-Gas Txs** | Suspicious failed attempts | MEDIUM | Exploit testing |
| **Suspicious Patterns** | Anomaly scoring | LOW-HIGH | Address reconnaissance |

> **Future Plans**: Static code analysis via bytecode scanning may be added in later versions.

## 🏗️ Architecture

ChainGuard uses a **hybrid real-time architecture** with WebSocket block monitoring and automatic fallback to ensure 100% uptime:

```
┌─────────────────────────────────────────────────────────────┐
│       Transaction Monitoring (Hybrid Resilient)             │
│  Primary: WebSocket Block Watcher (~1-2s latency)          │
│  Fallback: 5-minute Polling + 30s Auto-reconnect           │
│  ✓ Real-time monitoring with guaranteed reliability         │
└────────────────────────┬────────────────────────────────────┘
                         │ Transactions
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            ChainGuard Backend - Rule Engine                  │
│  • 8 Behavioral Heuristics (flash loan, bot, DDoS, etc.)    │
│  • Composite Risk Analysis (score + level + primary factor) │
│  • Frequency Tracking (LRU cache) + Priority Queue          │
└─────────────┬──────────────────────┬────────────────────────┘
              │ Security Findings    │ Risk Scores (≥30)
              ↓                      ↓
┌─────────────────────────────────────────────────────────────┐
│        Somnia Data Streams - Dual Publishing                │
│  • SecurityAlert: Detailed findings (9 fields)              │
│  • RiskScore: Real-time risk metrics (9 fields)             │
│  • Threshold filtering (risk >= 30 published)               │
│  • setAndEmitEvents() for atomic write + notify             │
└────────────┬──────────────────────┬─────────────────────────┘
             │ SDS Events           │ Risk Feed
             ↓                      ↓
┌─────────────────────────────┐  ┌──────────────────────────┐
│  N8N Workflow (LLM)         │  │  Live Risk Feed (SDS)    │
│  • RAG: Vector DB search    │  │  • useRiskScores() hook  │
│  • Claude API validation    │  │  • Real-time risk stream │
│  • Returns validation data  │  │  • Contract filtering    │
└────────────┬────────────────┘  └──────────┬───────────────┘
             │ Validation Result            │
             ↓                              │
┌─────────────────────────────────────────────────────────────┐
│            PostgreSQL Database (Neon/Supabase)              │
│  • Stores contracts, findings, alerts, transactions         │
│  • LLM validation results & confidence scores               │
│  • Baseline metrics for adaptive anomaly detection          │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket + SDS Subscription
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                ChainGuard Frontend (React)                   │
│  • Real-time alerts via SDS (useSecurityAlerts hook)        │
│  • Live risk feed via SDS (useRiskScores hook)              │
│  • Push-based updates (no polling needed)                   │
│  • Alert management & contract monitoring                   │
│  • Wallet authentication (MetaMask, etc.)                   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Project Structure

```
somnia-data-stream/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── api/          # REST endpoints (contracts, alerts, stats, auth, monitor)
│   │   ├── services/     # WebSocket monitoring + SDS publishing
│   │   ├── schemas/      # SDS schemas (SecurityAlert, RiskScore)
│   │   ├── rules/        # 8 behavioral heuristics + risk scoring
│   │   ├── llm/          # N8N webhook validator
│   │   ├── queues/       # Priority validation queue (Bull)
│   │   ├── jobs/         # Background workers (baseline updates)
│   │   ├── utils/        # Helpers, logger
│   │   └── db/           # Prisma client
│   ├── prisma/           # Database schema
│   └── clear-db.ts       # Database cleanup utility
│
├── frontend/             # React + TypeScript UI
│   ├── src/
│   │   ├── pages/        # Dashboard, Monitor, Alerts
│   │   ├── components/   # UI components (shadcn/ui)
│   │   ├── hooks/        # SDS hooks (useSecurityAlerts, useRiskScores)
│   │   ├── contexts/     # Auth context
│   │   ├── utils/        # Formatters, helpers
│   │   └── lib/          # API client, utilities
│   └── public/
│
├── knowledge-base/       # RAG-optimized docs for LLM validation
│   ├── flash_loan_attacks.md
│   ├── botting_attacks.md
│   ├── ddos_attacks.md
│   ├── spam_attacks.md
│   ├── governance_attacks.md
│   ├── suspicious_patterns.md
│   └── README.md         # RAG integration guide
│
├── knowledge-base-backup/  # Original code-level docs (future use)
│
└── test-environment/     # Smart contracts for testing
    ├── contracts/        # Solidity test contracts
    └── scripts/          # Deployment & simulation scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** database (or Neon/Supabase)
- **Somnia RPC access** (devnet or testnet)
- **N8N instance** (for LLM validation) - optional but recommended

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set:
# - JWT_SECRET (REQUIRED): openssl rand -base64 32
# - DATABASE_URL
# - SDS_RPC_URL (Somnia devnet/testnet)
# - LLM_WEBHOOK_URL (N8N webhook)

# Setup database
npx prisma generate
npx prisma db push

# Start backend
npm run dev
# Backend runs on http://localhost:3000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment (optional, defaults to localhost:3000)
echo "VITE_API_URL=http://localhost:3000" > .env
echo "VITE_WS_URL=http://localhost:3000" >> .env

# Start frontend
npm run dev
# Frontend runs on http://localhost:8080
```

### 3. N8N Workflow Setup (Optional)

The LLM validation enhances detection accuracy. Without N8N:
- ✅ Backend still works and detects all 8 patterns
- ❌ Findings won't have LLM confidence scores
- ⚠️ Higher false positive rate

**To enable LLM validation:**

1. Set up N8N instance
2. Create RAG workflow:
   - Webhook trigger (receives findings from backend)
   - Vector DB node (search knowledge-base/ docs)
   - Claude/OpenAI node (validate with context)
   - Response node (return validation to backend)
3. Set `LLM_WEBHOOK_URL` in backend `.env`

See [knowledge-base/README.md](knowledge-base/README.md) for detailed RAG setup.

## 🔍 How It Works

### 1. Real-Time Transaction Capture (Hybrid Resilient Architecture)

ChainGuard uses **WebSocket block monitoring** with automatic fallback for guaranteed uptime:

```typescript
// backend/src/services/monitor.ts - Primary: WebSocket (~1-2s latency)
private async startBlockWatcher(contractAddress: string, network: string) {
  const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;

  const unwatch = client.watchBlockNumber({
    onBlockNumber: async (blockNumber: bigint) => {
      // Real-time block monitoring
      this.watcherHealth.set(contractAddress, Date.now());
      const block = await client.getBlock({ blockNumber, includeTransactions: true });

      // Filter transactions for monitored contract
      const relevantTxs = block.transactions.filter((tx: any) =>
        tx.to?.toLowerCase() === contractAddress.toLowerCase() ||
        tx.from?.toLowerCase() === contractAddress.toLowerCase()
      );

      // Analyze and publish in real-time
      for (const tx of relevantTxs) {
        await this.processTransactionFromBlock(tx, contractAddress, network);
      }
    },
    onError: (error: Error) => {
      // Automatic fallback on connection failure
      this.activatePollingFallback(contractAddress, network);
    }
  });

  this.blockWatchers.set(contractAddress, unwatch);
}

// Fallback: 5-minute polling + auto-reconnect
private activatePollingFallback(contractAddress: string, network: string) {
  this.fallbackActive.set(contractAddress, true);

  // Stop WebSocket watcher
  const unwatch = this.blockWatchers.get(contractAddress);
  if (unwatch) unwatch();

  // Start 5-minute polling
  const interval = setInterval(
    () => this.pollForNewTransactions(contractAddress, network),
    300000
  );
  this.pollingIntervals.set(contractAddress, interval);

  // Attempt WebSocket reconnection every 30 seconds
  this.attemptWebSocketReconnection(contractAddress, network);
}
```

**Hybrid Architecture Benefits:**
- ✅ **Primary: WebSocket** - ~1-2s latency for critical threat detection
- ✅ **Fallback: Polling** - 5-minute intervals ensure 100% transaction coverage
- ✅ **Auto-reconnect** - 30-second attempts to restore real-time monitoring
- ✅ **Zero downtime** - Seamless transition between modes

### 2. Dual Publishing to Somnia Data Streams

ChainGuard publishes both **detailed security alerts** and **real-time risk scores** to SDS for maximum composability:

#### Security Alerts (Detailed Findings)

```typescript
// backend/src/services/monitor.ts - SecurityAlert publishing
async publishFindingToSDS(finding: Finding, network: string, txHash: string) {
  const schemaEncoder = new SchemaEncoder(securityAlertSchema);
  const encodedData = schemaEncoder.encodeData([
    { name: 'timestamp', value: Date.now(), type: 'uint64' },
    { name: 'contractAddress', value: finding.contractAddress, type: 'address' },
    { name: 'txHash', value: txHash, type: 'bytes32' },
    { name: 'alertType', value: finding.type, type: 'string' },
    { name: 'severity', value: finding.severity, type: 'string' },
    { name: 'description', value: finding.description, type: 'string' },
    { name: 'value', value: transaction.value, type: 'uint256' },
    { name: 'gasUsed', value: transaction.gasUsed, type: 'uint256' },
    { name: 'confidence', value: finding.ruleConfidence, type: 'uint8' }
  ]);

  await sdk.streams.setAndEmitEvents(
    [{ id: alertId, schemaId, data: encodedData }],
    [{ id: 'SecurityAlertV2', argumentTopics, data }]
  );
}
```

#### Risk Scores (Live Risk Feed)

```typescript
// backend/src/services/monitor.ts - RiskScore publishing
async publishRiskScoreToSDS(
  riskAnalysis: RiskAnalysis,
  transaction: Transaction,
  contractAddress: string
) {
  // Threshold filtering: Only publish risk >= 30 (MEDIUM+)
  if (riskAnalysis.riskScore < 30) {
    logger.info(`Risk score ${riskAnalysis.riskScore} below threshold, skipping SDS publish`);
    return;
  }

  const schemaEncoder = new SchemaEncoder(riskScoreSchema);
  const encodedData = schemaEncoder.encodeData([
    { name: 'timestamp', value: Date.now(), type: 'uint64' },
    { name: 'contractAddress', value: contractAddress, type: 'address' },
    { name: 'sender', value: transaction.from, type: 'address' },
    { name: 'txHash', value: transaction.hash, type: 'bytes32' },
    { name: 'riskScore', value: riskAnalysis.riskScore, type: 'uint8' },
    { name: 'riskLevel', value: riskAnalysis.riskLevel, type: 'string' },
    { name: 'primaryFactor', value: riskAnalysis.primaryFactor, type: 'string' },
    { name: 'value', value: transaction.value, type: 'uint256' },
    { name: 'gasUsed', value: transaction.gasUsed, type: 'uint256' }
  ]);

  await sdk.streams.setAndEmitEvents(
    [{ id: riskId, schemaId, data: encodedData }],
    [{ id: 'RiskScore', argumentTopics, data }]
  );
}
```

**Frontend Subscriptions:**

```typescript
// frontend/src/hooks/useSecurityAlerts.ts - Detailed security findings
const { alerts, isConnected } = useSecurityAlerts();

// frontend/src/hooks/useRiskScores.ts - Real-time risk metrics
const { riskScores, getHighRiskScores, getCriticalRiskScores } = useRiskScores({
  contractAddress: '0x123...',  // Optional filtering
  maxScores: 100                // Keep latest N scores
});
```

**Key Benefits:**
- ✅ **Dual streams**: SecurityAlert (detailed) + RiskScore (lightweight)
- ✅ **Threshold filtering**: RiskScore only publishes risk >= 30 (reduces volume 80-90%)
- ✅ **Structured data**: Two custom schemas with typed fields
- ✅ **On-chain storage**: Permanent audit trail via `setAndEmitEvents()`
- ✅ **Real-time push**: WebSocket subscriptions for zero-latency updates
- ✅ **Composability**: Other dApps can build on our security intelligence

### 3. Behavioral Analysis (Composite Risk Scoring)

ChainGuard's rule engine returns a **composite risk analysis** combining score, level, primary factor, and findings:

```typescript
// backend/src/rules/engine.ts - RiskAnalysis Interface
export interface RiskAnalysis {
  riskScore: number;      // 0-100 composite score
  riskLevel: string;      // SAFE, LOW, MEDIUM, HIGH, CRITICAL
  primaryFactor: string;  // Main risk contributor
  findings: Finding[];    // Detailed findings from heuristics
}

export async function analyzeTransaction(tx: Transaction): Promise<RiskAnalysis> {
  const findings: Finding[] = [];
  let maxRiskScore = 0;
  let primaryFactor = 'Normal transaction';

  // Example: Flash Loan Detection (Risk Scoring)
  let flashLoanScore = 0;
  if (tx.value > 1000) flashLoanScore += 30;
  if (tx.gasUsed > 1000000) flashLoanScore += 25;
  if (tx.gasUsed > 300000) flashLoanScore += 20;

  if (flashLoanScore >= 50) {
    findings.push({
      type: 'FLASH_LOAN_ATTACK',
      severity: flashLoanScore >= 80 ? 'CRITICAL' : 'HIGH',
      confidence: 0.85,
      description: `High-risk flash loan pattern detected`
    });

    if (flashLoanScore > maxRiskScore) {
      maxRiskScore = flashLoanScore;
      primaryFactor = 'Potential flash loan attack';
    }
  }

  // Example: Bot Detection (Frequency Tracking)
  const txCount = addressFrequency.get(tx.from) || 0;
  if (txCount > 5) {  // >5 txs/minute
    const botScore = 45;
    findings.push({
      type: 'HIGH_FREQUENCY_BOT',
      severity: 'MEDIUM',
      confidence: 0.80
    });

    if (botScore > maxRiskScore) {
      maxRiskScore = botScore;
      primaryFactor = 'High-frequency bot activity';
    }
  }

  // Map score to risk level
  const riskLevel = calculateRiskLevel(maxRiskScore);

  return { riskScore: maxRiskScore, riskLevel, primaryFactor, findings };
}

function calculateRiskLevel(score: number): string {
  if (score >= 80) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  if (score >= 10) return 'LOW';
  return 'SAFE';
}
```

### 4. LLM Validation (N8N Webhook)

```typescript
// backend/src/llm/validator.ts
const validation = await fetch(LLM_WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify({
    finding: {
      type: 'FLASH_LOAN_ATTACK',
      riskScore: 75,
      transaction: {...},
      factors: ['High value: 5000 STT', 'High gas: 850k']
    }
  })
});

// N8N workflow:
// 1. Vector DB search knowledge base for relevant context
// 2. Claude API validates with RAG context
// 3. Returns: { valid, confidence, severity, reason, recommendation }

// Backend updates finding with LLM result
await prisma.finding.update({
  data: {
    llmValidated: true,
    llmConfidence: 85,
    llmSeverity: 'HIGH',
    llmReasoning: 'Transaction shows classic flash loan pattern...'
  }
});
```

### 5. Real-Time Alerts (WebSocket)

```typescript
// backend/src/server.ts
io.emit('alert', {
  id: finding.id,
  type: 'FLASH_LOAN_ATTACK',
  severity: 'HIGH',
  contractAddress: '0x...',
  txHash: '0x...',
  llmConfidence: 85,
  timestamp: new Date()
});

// Frontend receives via Socket.io
socket.on('alert', (alert) => {
  showNotification(alert);
  playAlertSound();
});
```

## 📊 API Reference

### Contracts
- `POST /api/contracts` - Add contract to monitor
- `GET /api/contracts` - List monitored contracts
- `DELETE /api/contracts/:address` - Stop monitoring

### Alerts
- `GET /api/alerts` - List alerts (filter by severity, type, contract)
- `GET /api/alerts/:id` - Get alert details
- `POST /api/alerts/:id/resolve` - Mark as resolved

### Stats
- `GET /api/stats` - Dashboard statistics (total alerts, by type, recent activity)

### Auth
- `POST /api/auth/nonce` - Get nonce for wallet signature
- `POST /api/auth/verify` - Verify signature and get JWT

### Monitor
- `POST /api/monitor/start/:address` - Start monitoring contract
- `POST /api/monitor/stop/:address` - Stop monitoring contract

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run webhook validation tests
npm run test:webhook

# List available test cases
npm run test:webhook:list

# Run specific test case
npm run test:webhook:single 0
```

### Test Environment

```bash
cd test-environment

# Deploy test contracts to Somnia devnet
npm run deploy

# Run attack simulations
npm run simulate
```

## 🔧 Configuration

### Backend Environment Variables

```env
# CRITICAL: JWT authentication (REQUIRED)
JWT_SECRET="generate-with-openssl-rand-base64-32"

# Database
DATABASE_URL="postgresql://user:pass@host:5432/chainguard"

# Somnia Data Streams
SDS_RPC_URL="https://dream-rpc.somnia.network"  # or testnet
NETWORK_ID="50094"  # devnet (or 50311 for testnet)

# LLM Validation (optional)
LLM_WEBHOOK_URL="https://n8n.yourdomain.com/webhook/chainguard-validate"

# Server
PORT=3000
FRONTEND_URL="http://localhost:8080"

# Redis (for validation queue)
REDIS_URL="redis://localhost:6379"
```

### Frontend Environment Variables

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

## 📚 Documentation

- **[Backend README](backend/README.md)** - API details, deployment
- **[Frontend README](frontend/README.md)** - UI components, development
- **[Knowledge Base](knowledge-base/README.md)** - RAG setup, LLM integration
- **[Test Environment](test-environment/README.md)** - Smart contracts, simulations
- **[Project Status Analysis](PROJECT_STATUS_ANALYSIS.md)** - Current implementation vs vision

## 🎨 Features

### ✅ Implemented

**Real-Time Monitoring:**
- Hybrid architecture: WebSocket block monitoring (~1-2s latency) with automatic 5-min polling fallback
- Auto-reconnect every 30 seconds when WebSocket drops
- Zero downtime: Seamless transition between real-time and fallback modes
- Duplicate detection via `lastProcessedBlock` tracking

**Somnia Data Streams Integration:**
- Dual publishing: SecurityAlert (detailed findings) + RiskScore (lightweight metrics)
- Custom SDS schemas with 9 typed fields each
- Threshold filtering: RiskScore only publishes risk >= 30 (reduces volume 80-90%)
- Frontend hooks: `useSecurityAlerts()` and `useRiskScores()` for real-time subscriptions
- On-chain storage with `setAndEmitEvents()` for permanent audit trail

**Security Analysis:**
- 8 behavioral heuristics (flash loan, bot, DDoS, spam, governance, etc.)
- Composite risk scoring: score (0-100) + level (SAFE/LOW/MEDIUM/HIGH/CRITICAL) + primary factor
- Frequency tracking with LRU cache for bot detection
- Adaptive baseline metrics for anomaly detection

**AI Validation:**
- Priority-based LLM validation queue (Bull + Redis)
- N8N webhook integration with RAG-powered Claude API
- Vector DB search of knowledge base for context
- Confidence scoring and severity validation

**Full-Stack Application:**
- REST API for contracts, alerts, stats, auth, monitoring
- React dashboard with real-time SDS updates
- Wallet authentication (MetaMask, WalletConnect, etc.)
- PostgreSQL database with Prisma ORM
- Database cleanup utility ([clear-db.ts](backend/clear-db.ts))
- Comprehensive testing guide ([DEMO.md](DEMO.md))

### 🚧 Future Enhancements

- Static code analysis (bytecode/AST scanning)
- Multi-chain support beyond Somnia
- Advanced ML models for pattern detection
- Historical attack playback
- Automated incident response
- Integration with security tools (Forta, OpenZeppelin Defender)

## 🤝 Contributing

Contributions welcome! Please:

1. Check [PROJECT_STATUS_ANALYSIS.md](PROJECT_STATUS_ANALYSIS.md) for current state
2. Create feature branch from `main`
3. Follow existing code style
4. Add tests for new heuristics
5. Update knowledge base if adding new attack patterns

## 📄 License

MIT

---

**Built with:**
- [Somnia Data Streams](https://docs.somnia.network/) - Real-time blockchain event streaming
- [Anthropic Claude](https://www.anthropic.com/) - LLM validation
- [N8N](https://n8n.io/) - Workflow automation for RAG
- [Prisma](https://www.prisma.io/) - Type-safe database ORM
- [React](https://react.dev/) + [shadcn/ui](https://ui.shadcn.com/) - Modern UI

**Deployment:**
- Backend: Railway, Render, or any Node.js host
- Database: Neon, Supabase, or PostgreSQL
- Frontend: Vercel, Netlify, or Cloudflare Pages
- N8N: Self-hosted or N8N Cloud
