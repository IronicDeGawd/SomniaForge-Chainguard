# ChainGuard Frontend

Real-time smart contract security monitoring dashboard powered by Somnia Data Streams.

## Features

- **Real-time Monitoring**: Live transaction monitoring via Somnia Data Streams
- **AI-Powered Validation**: LLM-based vulnerability validation with confidence scores
- **Security Alerts**: Instant notifications for critical vulnerabilities
- **Network Scanner**: Detect exploits across the entire network
- **Contract Management**: Add and monitor multiple smart contracts

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
src/
├── components/     # Reusable UI components
├── pages/          # Page components (Dashboard, Monitor, Scanner, Alerts)
├── hooks/          # Custom React hooks
├── lib/            # Utilities and helpers
└── types/          # TypeScript type definitions
```

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT
