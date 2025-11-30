import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import contractsRouter from './api/contracts.js';
import alertsRouter from './api/alerts.js';
import statsRouter from './api/stats.js';
import transactionsRouter from './api/transactions.js';

import monitorRouter from './api/monitor.js';
import authRouter from './api/auth.js';
import prisma from './db/prisma.js';
import { sdsMonitor } from './services/monitor.js';
import { logger } from './utils/logger.js';
import { startBaselineCalculationScheduler } from './jobs/baseline-calculator.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.IO with optional Redis adapter for horizontal scaling
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    methods: ['GET', 'POST']
  },
  // Enable connection state recovery for reconnection handling
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Setup Redis adapter if REDIS_URL or Upstash credentials are provided (for horizontal scaling)
const redisUrl = process.env.REDIS_URL || 
  (process.env.UPSTASH_REDIS_REST_URL ? `redis://:${process.env.UPSTASH_REDIS_REST_TOKEN}@${process.env.UPSTASH_REDIS_REST_URL.replace('https://', '')}` : null);

if (redisUrl) {
  logger.info('Redis configuration detected, attempting to setup Redis adapter for Socket.IO scaling...');
  
  // Use Promise-based dynamic imports to avoid TypeScript compilation errors
  Promise.all([
    import('@socket.io/redis-adapter').catch(() => null),
    import('redis').catch(() => null)
  ]).then(([adapterModule, redisModule]) => {
    if (!adapterModule || !redisModule) {
      logger.warn('⚠️  Redis packages not installed, running in single-instance mode');
      logger.info('To enable scaling: npm install @socket.io/redis-adapter redis');
      return;
    }
    
    const { createAdapter } = adapterModule;
    const { createClient } = redisModule;
    
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('✅ Redis adapter enabled - Socket.IO ready for horizontal scaling');
      })
      .catch((err) => {
        logger.warn('⚠️  Redis connection failed, running in single-instance mode:', err.message);
      });
  }).catch((err) => {
    logger.warn('⚠️  Failed to load Redis modules:', err.message);
  });
} else {
  logger.info('Running Socket.IO in single-instance mode (no Redis configured)');
}

// Inject IO into monitor service
sdsMonitor.setIo(io);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8080',
    'https://chainguard.somniaforge.com', // Production frontend
    'http://localhost:8080', // Development
    'http://127.0.0.1:8080'  // Local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/monitor', monitorRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Metrics endpoint (includes WebSocket connection count)
app.get('/metrics', (req, res) => {
  const connectedClients = io.engine.clientsCount;
  const instanceId = process.env.INSTANCE_ID || 'default';

  res.json({
    connectedClients,
    serverInstance: instanceId,
    timestamp: new Date().toISOString()
  });
});

// WebSocket connection handling with metrics
io.on('connection', (socket) => {
  const clientCount = io.engine.clientsCount;
  logger.info(`Client connected: ${socket.id} (Total: ${clientCount})`);

  socket.on('disconnect', () => {
    const clientCount = io.engine.clientsCount;
    logger.info(`Client disconnected: ${socket.id} (Total: ${clientCount})`);
  });
});

// Start server
server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server ready`);

  // Start baseline calculation scheduler
  startBaselineCalculationScheduler();

  // Start monitoring all active contracts
  try {
    const contracts = await prisma.contract.findMany({
      where: { status: { not: 'stopped' } }
    });

    logger.info(`Found ${contracts.length} active contracts to monitor`);

    for (const contract of contracts) {
      // Use the network field from the contract, default to 'testnet' if not set
      const network = contract.network || 'testnet';
      await sdsMonitor.startMonitoring(contract.address, network);
    }
  } catch (error) {
    logger.error('Failed to initialize monitoring:', error);
  }
});

// Export io for use in other modules
export { io };
// Restart trigger v3
