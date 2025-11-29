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

## 🚫 What We DON'T Detect

ChainGuard does **NOT** detect:
- ❌ **Static Code Vulnerabilities** (reentrancy, access control, etc.) - requires bytecode/AST analysis
- ❌ **Pre-Deployment Issues** - we analyze live transactions only
- ❌ **Logic Bugs** - business logic errors in contracts

> **Future Plans**: Static code analysis via bytecode scanning may be added in later versions.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Somnia Blockchain                         │
│              (Devnet: 50094 or Testnet: 50311)              │
└────────────────────────┬────────────────────────────────────┘
                         │ Events
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Somnia Data Streams (SDS) SDK                   │
│         Real-time event subscription (NOT polling)           │
└────────────────────────┬────────────────────────────────────┘
                         │ Transactions
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            ChainGuard Backend - Rule Engine                  │
│  • 8 Behavioral Heuristics (flash loan, bot, DDoS, etc.)    │
│  • Risk Scoring & Frequency Tracking (LRU cache)            │
│  • Priority-based Validation Queue                          │
└────────────────────────┬────────────────────────────────────┘
                         │ Finding
                         ↓
┌─────────────────────────────────────────────────────────────┐
│               N8N Workflow (LLM Validation)                  │
│  • RAG: Vector DB search of knowledge base                  │
│  • Claude API: Validate finding with context                │
│  • Returns: valid, confidence, severity, reasoning          │
└────────────────────────┬────────────────────────────────────┘
                         │ Validation Result
                         ↓
┌─────────────────────────────────────────────────────────────┐
│            PostgreSQL Database (Neon/Supabase)              │
│  • Stores contracts, findings, alerts                       │
│  • LLM validation results & confidence scores               │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket + REST
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                ChainGuard Frontend (React)                   │
│  • Real-time dashboard with Socket.io                       │
│  • Alert management & contract monitoring                   │
│  • Wallet authentication (MetaMask, etc.)                   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Project Structure

```
somnia-data-stream/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── api/          # REST endpoints (contracts, alerts, stats, auth)
│   │   ├── services/     # SDS monitor, contract manager
│   │   ├── rules/        # 8 behavioral heuristics (engine.ts)
│   │   ├── llm/          # N8N webhook validator
│   │   ├── queues/       # Priority validation queue (Bull)
│   │   ├── jobs/         # Background workers
│   │   └── db/           # Prisma client
│   └── prisma/           # Database schema
│
├── frontend/             # React + TypeScript UI
│   ├── src/
│   │   ├── pages/        # Dashboard, Monitor, Alerts
│   │   ├── components/   # UI components (shadcn/ui)
│   │   ├── hooks/        # Custom hooks (useAlerts, useContracts)
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

### 1. Real-Time Monitoring (Somnia Data Streams)

```typescript
// backend/src/services/monitor.ts
const subscription = await sdk.streams.subscribe({
  eventContractSource: contractAddress,  // Monitor specific contract
  topicOverrides: [],                    // All events
  onData: async (event) => {
    // Analyze each transaction
    const findings = await analyzeTransaction(event.transaction);
  }
});
```

**Key Point**: SDS uses **event-based subscriptions**, NOT schema-based filtering. You subscribe to a contract and get all events in real-time.

### 2. Behavioral Analysis (Rule Engine)

```typescript
// backend/src/rules/engine.ts - 8 Heuristics

// Example: Flash Loan Detection (Risk Scoring)
const riskScore = 0;
if (value > 1000) riskScore += 30;        // High value
if (gasUsed > 1000000) riskScore += 25;   // Extremely high gas
if (gasUsed > 300000) riskScore += 20;    // High gas

if (riskScore >= 50) {
  findings.push({
    type: 'FLASH_LOAN_ATTACK',
    severity: riskScore >= 80 ? 'CRITICAL' : 'HIGH',
    confidence: 0.85,
    factors: ['High value: 5000 STT', 'High gas: 850k']
  });
}

// Example: Bot Detection (Frequency Tracking)
const txCount = addressFrequency.get(sender) || 0;
if (txCount > 5) {  // >5 txs/minute
  findings.push({
    type: 'HIGH_FREQUENCY_BOT',
    severity: 'MEDIUM',
    confidence: 0.80
  });
}
```

### 3. LLM Validation (N8N Webhook)

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

### 4. Real-Time Alerts (WebSocket)

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

- Real-time transaction monitoring via Somnia Data Streams
- 8 behavioral heuristics (flash loan, bot, DDoS, spam, governance, etc.)
- Risk scoring and frequency tracking (LRU cache)
- Priority-based LLM validation queue
- N8N webhook integration for AI validation
- WebSocket real-time alerts
- REST API for contracts and alerts
- React dashboard with live updates
- Wallet authentication (MetaMask, etc.)
- PostgreSQL database with Prisma ORM
- RAG-optimized knowledge base for LLM

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
