# ChainGuard Backend

Backend API for ChainGuard smart contract security monitoring platform.

## Features

- **REST API**: CRUD operations for contracts, alerts, and statistics
- **WebSocket**: Real-time updates for alerts and transactions
- **Database**: PostgreSQL with Prisma ORM
- **LLM Integration**: Webhook client for AI-powered vulnerability validation
- **Rule Engine**: Pattern-based vulnerability detection

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
DATABASE_URL="postgresql://user:password@localhost:5432/chainguard"
PORT=3000
FRONTEND_URL="http://localhost:8080"
LLM_WEBHOOK_URL="https://n8n.ironyaditya.xyz/webhook/..."
```

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
src/
├── api/          # API route handlers
├── services/     # Business logic
├── db/           # Database client
├── sds/          # Somnia Data Streams integration
├── llm/          # LLM validator client
├── rules/        # Vulnerability detection rules
└── server.ts     # Express server setup
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
