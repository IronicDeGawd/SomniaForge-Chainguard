# ChainGuard Backend

Backend API for ChainGuard - real-time behavioral smart contract security monitoring.

## Features

**Real-Time Transaction Monitoring:**
- **Primary**: WebSocket block monitoring via `watchBlockNumber()` (~1-2s latency)
- **Fallback**: Automatic 5-minute polling when WebSocket connection fails
- **Auto-reconnect**: 30-second reconnection attempts to restore real-time monitoring
- **Zero downtime**: Seamless transition between WebSocket and polling modes
- **Duplicate prevention**: Track `lastProcessedBlock` to avoid reprocessing

**Somnia Data Streams Publishing:**
- **Dual Publishing**:
  - `SecurityAlert`: Detailed security findings (9 fields: timestamp, contractAddress, txHash, alertType, severity, description, value, gasUsed, confidence)
  - `RiskScore`: Lightweight risk metrics (9 fields: timestamp, contractAddress, sender, txHash, riskScore, riskLevel, primaryFactor, value, gasUsed)
- **Threshold Filtering**: RiskScore only publishes when risk >= 30 (MEDIUM+), reducing volume by 80-90%
- **On-chain Storage**: `setAndEmitEvents()` for atomic write + event emission
- **Real-time Push**: Frontend can subscribe via SDS WebSocket for zero-latency updates

**Security Analysis:**
- **8 Behavioral Heuristics**: Flash loan, bot, DDoS, spam, governance, high-value, failed high-gas, suspicious patterns
- **Composite Risk Scoring**: Returns score (0-100), level (SAFE/LOW/MEDIUM/HIGH/CRITICAL), and primary factor
- **Frequency Tracking**: LRU cache for bot detection (>5 txs/min threshold)
- **Adaptive Baselines**: 7-day rolling averages for anomaly detection

**AI-Powered Validation:**
- **N8N Webhook Integration**: RAG-powered Claude API validation
- **Priority Queue**: Bull + Redis with CRITICAL/HIGH/MEDIUM priority levels
- **Knowledge Base**: Vector DB search for contextual validation
- **Confidence Scoring**: 0-100 confidence with reasoning and recommendations

**Full API Suite:**
- **Contracts**: Add, list, monitor, remove contracts
- **Alerts**: Query, filter, resolve security alerts
- **Stats**: Dashboard analytics and metrics
- **Auth**: Wallet signature verification with JWT tokens
- **Monitor**: Start/stop monitoring endpoints

**Infrastructure:**
- **Database**: PostgreSQL with Prisma ORM
- **WebSocket**: Socket.io for real-time frontend updates
- **Database Utilities**: [clear-db.ts](./clear-db.ts) for cleanup between tests

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **WebSocket**: Socket.io
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Neon/Supabase)

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
# CRITICAL: JWT_SECRET is REQUIRED - server will not start without it
# Generate a secure secret: openssl rand -base64 32
JWT_SECRET="your-super-secret-jwt-key-min-32-chars-CHANGE-ME"

DATABASE_URL="postgresql://user:password@localhost:5432/chainguard"
PORT=3000
FRONTEND_URL="http://localhost:8080"
LLM_WEBHOOK_URL="https://n8n.ironyaditya.xyz/webhook/..."
```

> **⚠️ CRITICAL SECURITY REQUIREMENT:**  
> The `JWT_SECRET` environment variable **must** be set before starting the server.  
> The application will fail to start if this is missing to prevent authentication bypass vulnerabilities.  
> Generate a secure secret with: `openssl rand -base64 32`

### Database Setup

```bash
# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate

# (Optional) Open Prisma Studio
npx prisma studio
```

### Development

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Contracts

- `GET /api/contracts` - List all monitored contracts
- `POST /api/contracts` - Add contract to monitor
- `GET /api/contracts/:address` - Get contract details
- `DELETE /api/contracts/:address` - Remove contract

### Alerts

- `GET /api/alerts` - List alerts (with filters)
- `GET /api/alerts/:id` - Get alert details
- `POST /api/alerts/:id/resolve` - Mark alert as resolved

### Stats

- `GET /api/stats` - Get dashboard statistics

### Health

- `GET /health` - Health check endpoint

## Project Structure

```
backend/
├── src/
│   ├── api/          # API route handlers
│   │   ├── alerts.ts        # Alert management endpoints
│   │   ├── auth.ts          # Wallet authentication
│   │   ├── contracts.ts     # Contract CRUD operations
│   │   ├── monitor.ts       # Start/stop monitoring
│   │   ├── stats.ts         # Dashboard statistics
│   │   └── transactions.ts  # Transaction queries
│   ├── services/     # Business logic
│   │   └── monitor.ts       # WebSocket block watcher + SDS dual publishing
│   ├── schemas/      # SDS schema definitions
│   │   ├── security-alert.ts  # SecurityAlert schema (9 fields)
│   │   └── risk-score.ts      # RiskScore schema (9 fields)
│   ├── rules/        # Behavioral heuristics
│   │   └── engine.ts          # 8 heuristics + composite risk scoring
│   ├── llm/          # AI validation
│   │   └── validator.ts       # N8N webhook client
│   ├── queues/       # Background processing
│   │   └── validation-queue.ts  # Priority-based LLM queue
│   ├── jobs/         # Scheduled tasks
│   │   └── baseline-updater.ts  # 7-day baseline updates
│   ├── utils/        # Helpers
│   │   ├── logger.ts            # Winston logger
│   │   └── sds-helpers.ts       # SDS utilities
│   ├── db/           # Database client
│   │   └── prisma.ts            # Prisma instance
│   ├── config/       # Configuration
│   │   └── chains.ts            # Somnia chain configs
│   └── server.ts     # Express + Socket.io server
├── prisma/           # Database schema
│   └── schema.prisma    # 7 models (Contract, User, Alert, Finding, etc.)
└── clear-db.ts       # Database cleanup utility
```

## Testing

```bash
# Run webhook tests
npm run test:webhook

# List available tests
npm run test:webhook:list

# Run specific test
npm run test:webhook:single 0
```

## License

MIT
