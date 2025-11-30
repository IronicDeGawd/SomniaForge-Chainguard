# ChainGuard Frontend

Real-time blockchain security dashboard for behavioral attack pattern detection.

## Features

**Real-Time Data Streaming:**
- **Dual SDS Subscriptions**:
  - `useSecurityAlerts()` - Detailed security findings (9 fields)
  - `useRiskScores()` - Live risk metrics (9 fields)
- **Push-based Updates**: Zero-latency alerts via Somnia Data Streams WebSocket
- **Contract Filtering**: Subscribe to specific contracts or all monitored contracts
- **Automatic Reconnection**: Resilient SDS connections with error handling

**Security Intelligence:**
- **8 Attack Types**: Flash loan, bot, DDoS, spam, governance, high-value, failed high-gas, suspicious patterns
- **Composite Risk Scores**: 0-100 scores with risk levels (SAFE, LOW, MEDIUM, HIGH, CRITICAL)
- **Primary Factors**: Identify main risk contributors for each transaction
- **AI Validation**: LLM confidence ratings and reasoning for findings

**Dashboard & Monitoring:**
- **Contract Management**: Add/remove contracts to monitor
- **Alert Management**: Filter by severity, type, contract; resolve/dismiss alerts
- **Real-Time Stats**: Total alerts, breakdown by type, recent activity charts
- **Transaction History**: View all processed transactions with risk scores

**Authentication:**
- **Wallet-Based Auth**: MetaMask/WalletConnect signature-based login
- **JWT Tokens**: Secure session management
- **Protected Routes**: Automatic redirect for unauthenticated users

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Charts**: Recharts
- **Real-time**: Socket.io Client

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── pages/          # Page components
│   │   ├── Dashboard.tsx    # Stats overview and charts
│   │   ├── Monitor.tsx      # Contract monitoring management
│   │   ├── Alerts.tsx       # Alert list and filtering
│   │   └── Index.tsx        # Landing page
│   ├── components/     # Reusable UI components
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   ├── AlertCard.tsx    # Alert display card
│   │   └── RequireAuth.tsx  # Auth guard wrapper
│   ├── hooks/          # Custom React hooks
│   │   ├── useSecurityAlerts.ts  # SDS SecurityAlert subscription
│   │   ├── useRiskScores.ts      # SDS RiskScore subscription
│   │   └── useScannerData.ts     # Contract monitoring data
│   ├── contexts/       # React context providers
│   │   └── AuthContext.tsx       # Wallet authentication state
│   ├── utils/          # Utility functions
│   │   └── formatters.ts         # Date, number, address formatters
│   ├── lib/            # Core libraries
│   │   ├── api.ts              # Backend API client
│   │   └── utils.ts            # Helper functions
│   └── types/          # TypeScript type definitions
│       └── index.ts            # Shared types
└── public/             # Static assets
```

## SDS Subscription Hooks

ChainGuard provides two custom React hooks for subscribing to real-time data from Somnia Data Streams:

### useSecurityAlerts()

Subscribe to detailed security findings for all monitored contracts:

```typescript
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';

function AlertsPage() {
  const { alerts, isConnected, error } = useSecurityAlerts();

  return (
    <div>
      <p>Connection: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
      {alerts.map(alert => (
        <div key={alert.txHash}>
          <h3>{alert.alertType}</h3>
          <p>Severity: {alert.severity}</p>
          <p>Confidence: {alert.confidence}%</p>
          <p>{alert.description}</p>
        </div>
      ))}
    </div>
  );
}
```

**SecurityAlert Schema:**
- `timestamp`: Event timestamp (uint64)
- `contractAddress`: Monitored contract (address)
- `txHash`: Transaction hash (bytes32)
- `alertType`: Attack type (string)
- `severity`: CRITICAL/HIGH/MEDIUM/LOW (string)
- `description`: Detailed explanation (string)
- `value`: Transaction value in wei (uint256)
- `gasUsed`: Gas consumed (uint256)
- `confidence`: Rule confidence 0-100 (uint8)

### useRiskScores()

Subscribe to live risk score metrics with optional filtering:

```typescript
import { useRiskScores } from '@/hooks/useRiskScores';

function RiskFeed() {
  const {
    riskScores,
    isConnected,
    error,
    getHighRiskScores,
    getCriticalRiskScores,
    getRiskScoresByContract
  } = useRiskScores({
    contractAddress: '0x123...',  // Optional: filter by contract
    maxScores: 100                // Keep latest N scores (default: 100)
  });

  const criticalRisks = getCriticalRiskScores();  // risk >= 80
  const highRisks = getHighRiskScores();          // risk >= 65

  return (
    <div>
      <h2>Live Risk Feed</h2>
      {riskScores.map(score => (
        <div key={score.txHash}>
          <p>Risk: {score.riskScore} ({score.riskLevel})</p>
          <p>Primary Factor: {score.primaryFactor}</p>
          <p>Sender: {score.sender}</p>
        </div>
      ))}
    </div>
  );
}
```

**RiskScore Schema:**
- `timestamp`: Event timestamp (uint64)
- `contractAddress`: Monitored contract (address)
- `sender`: Transaction sender (address)
- `txHash`: Transaction hash (bytes32)
- `riskScore`: Composite score 0-100 (uint8)
- `riskLevel`: SAFE/LOW/MEDIUM/HIGH/CRITICAL (string)
- `primaryFactor`: Main risk contributor (string)
- `value`: Transaction value in wei (uint256)
- `gasUsed`: Gas consumed (uint256)

**Note:** RiskScore only publishes for transactions with risk >= 30 (MEDIUM or higher) to reduce data volume.

## Environment Variables

Create a `.env` file in the root directory:

```env
# Development
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
VITE_WALLETCONNECT_PROJECT_ID=c610a77921343a8d39d801edc4c601b9
VITE_LOG_LEVEL=debug

# Production (.env.production)
VITE_API_URL=https://rest.somniaforge.com
VITE_WS_URL=https://rest.somniaforge.com
VITE_WALLETCONNECT_PROJECT_ID=c610a77921343a8d39d801edc4c601b9
VITE_LOG_LEVEL=warn  # Suppress debug logs in production
```

## Production Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` directory with:
- Code splitting (vendor + wagmi chunks)
- Minification and tree-shaking
- Source maps disabled for production

### Preview Production Build

```bash
npm run preview
```

Starts a preview server on port 3001 (configured for PM2 deployment).

### EC2 Deployment

The frontend runs on AWS EC2 with:
- **Port**: 3001 (localhost only, proxied via Caddy)
- **Process Manager**: PM2 with vite preview
- **Domain**: chainguard.somniaforge.com
- **Reverse Proxy**: Caddy (HTTPS, gzip, CORS)

See [`../deployment/README.md`](../deployment/README.md) for complete deployment guide.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT
