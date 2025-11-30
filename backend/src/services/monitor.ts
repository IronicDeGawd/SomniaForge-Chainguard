import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket, encodeAbiParameters, parseAbiParameters, pad } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { randomBytes } from 'crypto';
import prisma from '../db/prisma.js';
import { processTransaction, analyzeTransaction, Finding, RiskAnalysis } from '../rules/engine.js';
import { validateFindings } from '../llm/validator.js';
import { logger } from '../utils/logger.js';
import { serializeBigInt } from '../utils/serialization.js';
import { queueValidation } from '../queues/validation-queue.js';
import { securityAlertSchema, securityAlertEventId } from '../schemas/security-alert.js';
import { riskScoreSchema, riskScoreEventId } from '../schemas/risk-score.js';
import { toHex } from 'viem';

// Define Somnia Testnet chain
const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: {
    default: { 
      http: [process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'],
      webSocket: [process.env.SOMNIA_WS_URL || 'wss://dream-rpc.somnia.network/ws']
    },
    public: { 
      http: [process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'],
      webSocket: [process.env.SOMNIA_WS_URL || 'wss://dream-rpc.somnia.network/ws']
    }
  }
});

class SDSMonitor {
  private testnetSdk: SDK;
  private mainnetSdk: SDK;
  private testnetClient: any;
  private mainnetClient: any;
  private publisherAddress: `0x${string}` | undefined;

  // Map<contractAddress, { subscription, network }>
  private subscriptions: Map<string, { subscriptionId: string, unsubscribe: () => void, network: string }> = new Map();
  private isPaused: boolean = false;
  private io: any;

  // Event type tracking for diagnostics
  private eventTypeStats: Map<string, { count: number, lastSeen: Date }> = new Map();
  private debugEventCounts: Map<string, number> = new Map();
  private securityAlertSchemaId: string = '';
  private riskScoreSchemaId: string = '';
  private readonly zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Polling configuration (fallback mechanism)
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private POLLING_INTERVAL_MS = 60000; // 60 seconds (legacy/fallback)
  private FALLBACK_POLLING_INTERVAL_MS = 300000; // 5 minutes (when WebSocket fails)

  // WebSocket block monitoring (primary mechanism)
  private blockWatchers: Map<string, () => void> = new Map(); // Unwatch functions
  private watcherHealth: Map<string, number> = new Map();     // Last successful block time
  private fallbackActive: Map<string, boolean> = new Map();   // Fallback status
  private reconnectionTimers: Map<string, NodeJS.Timeout> = new Map(); // Reconnection attempt timers

  setIo(io: any) {
    this.io = io;
  }

  constructor() {
    // --- Testnet Setup ---
    const testnetWsUrl = process.env.SOMNIA_TESTNET_WS_URL || 'wss://dream-rpc.somnia.network/ws';
    // Create account from private key
    const privateKey = process.env.TESTNET_PRIVATE_KEY as `0x${string}`;
    const account = privateKey ? privateKeyToAccount(privateKey) : undefined;

    if (!account) {
      logger.warn('⚠️ No TESTNET_PRIVATE_KEY found. SDS publishing will be disabled.');
    } else {
      this.publisherAddress = account.address;
    }

    this.testnetClient = createPublicClient({
      chain: somniaTestnet,
      transport: webSocket(testnetWsUrl)
    });

    const walletClient = account ? createWalletClient({
      account,
      chain: somniaTestnet,
      transport: webSocket(testnetWsUrl)
    }) : undefined;

    this.testnetSdk = new SDK({
      public: this.testnetClient,
      wallet: walletClient
    });

    // --- Mainnet Setup ---
    // Define Somnia Mainnet Chain
    const somniaMainnet = {
      id: 5031,
      name: 'Somnia Mainnet',
      network: 'somnia-mainnet',
      nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
      rpcUrls: {
        default: { 
          http: [process.env.SOMNIA_MAINNET_RPC_URL || 'https://api.infra.mainnet.somnia.network'],
          webSocket: [process.env.SOMNIA_MAINNET_WS_URL || 'wss://api.infra.mainnet.somnia.network/ws']
        },
        public: { 
          http: [process.env.SOMNIA_MAINNET_RPC_URL || 'https://api.infra.mainnet.somnia.network'],
          webSocket: [process.env.SOMNIA_MAINNET_WS_URL || 'wss://api.infra.mainnet.somnia.network/ws']
        }
      }
    };

    const mainnetWsUrl = process.env.SOMNIA_MAINNET_WS_URL || 'wss://api.infra.mainnet.somnia.network/ws';
    this.mainnetClient = createPublicClient({
      chain: somniaMainnet,
      transport: webSocket(mainnetWsUrl)
    });

    this.mainnetSdk = new SDK({
      public: this.mainnetClient
    });

    // Register schemas on startup
    this.registerSchemas().catch(err => {
      logger.error('Failed to register SDS schemas:', err);
    });
  }

  /**
   * Register SDS schemas for structured data publishing
   */
  async registerSchemas() {
    try {
      logger.info('📝 Registering SDS schemas...');

      // 1. Register SecurityAlert schema
      const schemaIdResult = await this.testnetSdk.streams.computeSchemaId(securityAlertSchema);
      if (schemaIdResult instanceof Error) {
        throw schemaIdResult;
      }
      this.securityAlertSchemaId = schemaIdResult;
      logger.info(`  Schema ID for SecurityAlert: ${this.securityAlertSchemaId}`);

      const isRegistered = await this.testnetSdk.streams.isDataSchemaRegistered(this.securityAlertSchemaId as `0x${string}`);

      if (!isRegistered) {
        logger.info('  Schema not registered, registering now...');
        await this.testnetSdk.streams.registerDataSchemas([{
          schemaName: 'securityAlert',
          schema: securityAlertSchema,
          parentSchemaId: this.zeroBytes32 as `0x${string}`
        }]);
        logger.info('  ✅ SecurityAlert schema registered');
      } else {
        logger.info('  ✅ SecurityAlert schema already registered');
      }

      // Register event schema for subscriptions
      await this.testnetSdk.streams.registerEventSchemas([{
        id: securityAlertEventId,
        schema: {
          params: [
            { name: 'contractAddress', paramType: 'address', isIndexed: true },
            { name: 'publisher', paramType: 'address', isIndexed: true },
            { name: 'dataId', paramType: 'bytes32', isIndexed: false }
          ],
          eventTopic: 'ChainGuardAlert(address indexed contractAddress, address indexed publisher, bytes32 dataId)'
        }
      }]);
      logger.info('  ✅ SecurityAlert event schema registered');

      // 2. Register RiskScore schema (NEW)
      logger.info('  Registering RiskScore schema...');
      const riskSchemaIdResult = await this.testnetSdk.streams.computeSchemaId(riskScoreSchema);
      if (riskSchemaIdResult instanceof Error) {
        throw riskSchemaIdResult;
      }
      this.riskScoreSchemaId = riskSchemaIdResult;
      logger.info(`  Schema ID for RiskScore: ${this.riskScoreSchemaId}`);

      const isRiskSchemaRegistered = await this.testnetSdk.streams.isDataSchemaRegistered(this.riskScoreSchemaId as `0x${string}`);

      if (!isRiskSchemaRegistered) {
        await this.testnetSdk.streams.registerDataSchemas([{
          schemaName: 'riskScore',
          schema: riskScoreSchema,
          parentSchemaId: this.zeroBytes32 as `0x${string}`
        }]);
        logger.info('  ✅ RiskScore schema registered');
      } else {
        logger.info('  ✅ RiskScore schema already registered');
      }

      // Register RiskScore event schema
      await this.testnetSdk.streams.registerEventSchemas([{
        id: riskScoreEventId,
        schema: {
          params: [
            { name: 'contractAddress', paramType: 'address', isIndexed: true },
            { name: 'sender', paramType: 'address', isIndexed: true },
            { name: 'dataId', paramType: 'bytes32', isIndexed: false }
          ],
          eventTopic: 'RiskScore(address indexed contractAddress, address indexed sender, bytes32 dataId)'
        }
      }]);
      logger.info('  ✅ RiskScore event schema registered');

    } catch (error) {
      logger.error('Error registering SDS schemas:', error);
      // Don't throw, just log - we want the monitor to start even if schema reg fails (retry later?)
    }
  }

  /**
   * Start WebSocket block monitoring for a contract
   * Watches for new blocks and filters transactions for the monitored contract
   * Provides ~1-2s latency vs 60s polling
   */
  private async startBlockWatcher(contractAddress: string, network: string): Promise<void> {
    try {
      const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;

      logger.info(`🔌 Starting WebSocket block watcher for ${contractAddress} on ${network}`);

      // Watch for new blocks
      const unwatch = client.watchBlockNumber({
        onBlockNumber: async (blockNumber: bigint) => {
          try {
            // Update health timestamp
            this.watcherHealth.set(contractAddress, Date.now());

            logger.debug(`📦 New block ${blockNumber} detected, checking for ${contractAddress} transactions`);

            // Get block with full transactions
            const block = await client.getBlock({
              blockNumber,
              includeTransactions: true
            });

            // Filter for monitored contract interactions
            const relevantTxs = (block.transactions as any[]).filter((tx: any) =>
              tx.to?.toLowerCase() === contractAddress.toLowerCase() ||
              tx.from?.toLowerCase() === contractAddress.toLowerCase()
            );

            if (relevantTxs.length > 0) {
              logger.info(`🔍 Found ${relevantTxs.length} transactions for ${contractAddress} in block ${blockNumber}`);
            }

            // Process each relevant transaction
            for (const tx of relevantTxs) {
              await this.processTransactionFromBlock(tx, contractAddress, network);
            }
          } catch (error) {
            logger.error(`❌ Block watcher error for ${contractAddress}:`, error);
            // Activate fallback on error
            this.activatePollingFallback(contractAddress, network);
          }
        },
        onError: (error: Error) => {
          logger.error(`❌ WebSocket error for ${contractAddress}:`, error);
          // Activate fallback on WebSocket error
          this.activatePollingFallback(contractAddress, network);
        }
      });

      // Store unwatch function for cleanup
      this.blockWatchers.set(contractAddress, unwatch);
      this.watcherHealth.set(contractAddress, Date.now());

      logger.info(`✅ WebSocket block watcher active for ${contractAddress}`);
    } catch (error) {
      logger.error(`❌ Failed to start block watcher for ${contractAddress}:`, error);
      throw error;
    }
  }

  /**
   * Process transaction from WebSocket block watcher
   * Unified pipeline for both WebSocket and polling sources
   */
  private async processTransactionFromBlock(
    tx: any,
    contractAddress: string,
    network: string
  ): Promise<void> {
    try {
      const txHash = tx.hash;

      if (!txHash) {
        logger.debug('Transaction has no hash, skipping');
        return;
      }

      // Check for duplicate transaction (prevent reprocessing)
      const existingTx = await prisma.transaction.findUnique({
        where: { hash: txHash }
      });

      if (existingTx) {
        logger.debug(`Duplicate transaction ${txHash} detected, skipping`);
        return;
      }

      const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;

      // Get transaction receipt for gas and status
      const receipt = await client.getTransactionReceipt({ hash: txHash });

      // Store transaction in database
      const storedTx = await prisma.transaction.create({
        data: {
          hash: txHash,
          from: tx.from,
          to: tx.to || contractAddress,
          value: tx.value.toString(),
          gasUsed: Number(receipt.gasUsed),
          status: receipt.status === 'success' ? 'success' : 'failed',
          timestamp: new Date(),
          contractAddress: contractAddress,
          blockNumber: BigInt(tx.blockNumber || 0)
        }
      });

      logger.info(`💾 Stored transaction ${txHash.slice(0, 10)}... for ${contractAddress}`);

      // Convert to format expected by rule engine
      const transaction = {
        hash: txHash,
        from: tx.from,
        to: tx.to || contractAddress,
        value: tx.value.toString(),
        input: tx.input || '0x',
        gasUsed: Number(receipt.gasUsed),
        status: receipt.status === 'success' ? 'success' : 'failed',
        network
      };

      // Run rule engine analysis
      const riskAnalysis = await analyzeTransaction(transaction);
      const { findings, riskScore, riskLevel, primaryFactor } = riskAnalysis;

      logger.info(
        `📊 Analysis complete: ${findings.length} findings, risk ${riskScore} (${riskLevel})`
      );

      // Publish findings to SDS (SecurityAlert schema)
      for (const finding of findings) {
        await this.publishFindingToSDS(finding, network, txHash);
      }

      // Publish risk score to SDS (RiskScore schema - threshold: risk >= 30)
      await this.publishRiskScoreToSDS(riskAnalysis, transaction, contractAddress, network);

      // Queue for LLM validation if findings exist
      if (findings.length > 0) {
        for (const finding of findings) {
          const createdFinding = await prisma.finding.create({
            data: {
              contractAddress: finding.contractAddress,
              type: finding.type,
              severity: finding.severity,
              line: finding.line,
              functionName: finding.functionName,
              codeSnippet: finding.codeSnippet,
              ruleConfidence: finding.ruleConfidence,
              description: finding.description,
              validated: false
            }
          });

          // Queue for LLM validation with priority
          const priority = finding.severity === 'CRITICAL' ? 'high' :
                          finding.severity === 'HIGH' ? 'medium' : 'low';
          await queueValidation(createdFinding, priority);
        }
      }

      // Update contract stats
      await this.updateContractStats(contractAddress, transaction);

      // Emit WebSocket event to frontend
      if (this.io) {
        this.io.emit('transaction', {
          contractAddress,
          hash: txHash,
          from: tx.from,
          to: tx.to,
          gasUsed: Number(receipt.gasUsed),
          status: receipt.status,
          findingsCount: findings.length,
          riskScore,
          riskLevel
        });

        if (findings.length > 0) {
          this.io.emit('new_findings', {
            contractAddress,
            count: findings.length,
            riskScore,
            riskLevel,
            primaryFactor,
            findings: findings.map(f => ({
              type: f.type,
              severity: f.severity,
              description: f.description
            }))
          });
        }
      }
    } catch (error) {
      logger.error(`Error processing transaction from block:`, error);
    }
  }

  /**
   * Activate polling fallback when WebSocket fails
   * Switches to 5-minute polling interval and attempts reconnection
   */
  private activatePollingFallback(contractAddress: string, network: string): void {
    // Prevent duplicate fallback activation
    if (this.fallbackActive.get(contractAddress)) {
      logger.debug(`Fallback already active for ${contractAddress}`);
      return;
    }

    logger.warn(`⚠️  Activating polling fallback for ${contractAddress}`);
    this.fallbackActive.set(contractAddress, true);

    // Stop WebSocket watcher if it exists
    const unwatch = this.blockWatchers.get(contractAddress);
    if (unwatch) {
      unwatch();
      this.blockWatchers.delete(contractAddress);
    }

    // Clear existing polling interval if any
    if (this.pollingIntervals.has(contractAddress)) {
      clearInterval(this.pollingIntervals.get(contractAddress));
    }

    // Start polling with 5-minute interval (fallback mode)
    logger.info(`🕒 Starting fallback polling for ${contractAddress} every ${this.FALLBACK_POLLING_INTERVAL_MS/1000}s`);

    const interval = setInterval(async () => {
      await this.pollForNewTransactions(contractAddress, network);
    }, this.FALLBACK_POLLING_INTERVAL_MS);

    this.pollingIntervals.set(contractAddress, interval);

    // Attempt WebSocket reconnection every 30 seconds
    this.attemptWebSocketReconnection(contractAddress, network);
  }

  /**
   * Attempt to reconnect WebSocket watcher
   * Retries every 30 seconds until successful
   */
  private attemptWebSocketReconnection(contractAddress: string, network: string): void {
    // Clear existing reconnection timer if any
    if (this.reconnectionTimers.has(contractAddress)) {
      clearTimeout(this.reconnectionTimers.get(contractAddress));
    }

    logger.info(`🔄 Scheduling WebSocket reconnection attempt for ${contractAddress} in 30s`);

    const timer = setTimeout(async () => {
      logger.info(`🔌 Attempting WebSocket reconnection for ${contractAddress}...`);

      try {
        // Try to restart block watcher
        await this.startBlockWatcher(contractAddress, network);

        // If successful, deactivate fallback
        this.fallbackActive.set(contractAddress, false);

        // Clear polling interval
        if (this.pollingIntervals.has(contractAddress)) {
          clearInterval(this.pollingIntervals.get(contractAddress));
          this.pollingIntervals.delete(contractAddress);
        }

        logger.info(`✅ WebSocket reconnected for ${contractAddress}, fallback deactivated`);
      } catch (error) {
        logger.warn(`❌ WebSocket reconnection failed for ${contractAddress}, will retry in 30s`);
        // Schedule another reconnection attempt
        this.attemptWebSocketReconnection(contractAddress, network);
      }
    }, 30000); // 30 seconds

    this.reconnectionTimers.set(contractAddress, timer);
  }

  /**
   * Start monitoring a contract using SDS subscription
   * @param contractAddress The address to monitor
   * @param network 'testnet' or 'mainnet' (default: 'testnet')
   */
  // Map<contractAddress, NodeJS.Timeout>
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start monitoring a contract - WebSocket first with polling fallback
   * @param contractAddress The address to monitor
   * @param network 'testnet' or 'mainnet' (default: 'testnet')
   */
  async startMonitoring(contractAddress: string, network: string = 'testnet') {
    // Clear any existing retry timeout
    if (this.retryTimeouts.has(contractAddress)) {
      clearTimeout(this.retryTimeouts.get(contractAddress));
      this.retryTimeouts.delete(contractAddress);
    }

    logger.info(`🚀 Starting monitoring for ${contractAddress} on ${network}`);

    try {
      // 1. Backfill historical transactions from Explorer API
      const initialTxCount = await this.backfillHistory(contractAddress, network);
      logger.info(`🔢 Backfilled ${initialTxCount} historical transactions for ${contractAddress}`);

      // Update contract status
      await prisma.contract.update({
        where: { address: contractAddress },
        data: {
          status: 'healthy',
          network,
          totalTxs: initialTxCount
        }
      });

      // 2. Try WebSocket block monitoring first
      try {
        await this.startBlockWatcher(contractAddress, network);
        logger.info(`✅ WebSocket monitoring active for ${contractAddress} (~1-2s latency)`);
      } catch (wsError) {
        logger.warn(`⚠️  WebSocket failed for ${contractAddress}, activating polling fallback:`, wsError);
        this.activatePollingFallback(contractAddress, network);
      }

    } catch (error) {
      logger.error(`❌ Error starting monitoring for ${contractAddress}:`, error);
      this.handleMonitoringFailure(contractAddress, network, 1);
    }
  }

  /**
   * Start periodic polling for new transactions
   */
  private startPeriodicPolling(contractAddress: string, network: string) {
    // Clear existing interval if any
    if (this.pollingIntervals.has(contractAddress)) {
      clearInterval(this.pollingIntervals.get(contractAddress));
    }

    logger.info(`🕒 Starting periodic polling for ${contractAddress} every ${this.POLLING_INTERVAL_MS/1000}s`);

    // Initial poll immediately
    this.pollForNewTransactions(contractAddress, network).catch(err => {
      logger.error(`Error in initial poll for ${contractAddress}:`, err);
    });

    const interval = setInterval(async () => {
      await this.pollForNewTransactions(contractAddress, network);
    }, this.POLLING_INTERVAL_MS);

    this.pollingIntervals.set(contractAddress, interval);
  }

  /**
   * Poll for new transactions from Explorer API
   */
  private async pollForNewTransactions(contractAddress: string, network: string) {
    try {
      // Get last processed block
      const contract = await prisma.contract.findUnique({
        where: { address: contractAddress },
        select: { lastProcessedBlock: true }
      });

      if (!contract) return;

      const lastBlock = contract.lastProcessedBlock || BigInt(0);
      const explorerUrl = network === 'mainnet'
        ? 'https://explorer.somnia.network'
        : 'https://shannon-explorer.somnia.network';

      // Fetch transactions since last block
      const startBlock = lastBlock > BigInt(0) ? (lastBlock + BigInt(1)).toString() : '0';
      const response = await fetch(
        `${explorerUrl}/api?module=account&action=txlist&address=${contractAddress}&startblock=${startBlock}`
      );

      if (response.ok) {
        const data = await response.json() as any;
        if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
          const newTransactions = data.result;
          logger.info(`📥 Polled ${newTransactions.length} new txs for ${contractAddress}`);

          let maxBlock = lastBlock;
          let newTxCount = 0;
          let failedCount = 0;
          let totalGas = BigInt(0);

          for (const tx of newTransactions) {
            const blockNum = BigInt(tx.blockNumber);
            const gasUsed = parseInt(tx.gasUsed);
            
            // Skip if already processed (double check)
            if (blockNum <= lastBlock) continue;

            const transaction = {
              hash: tx.hash,
              from: tx.from,
              to: tx.to || contractAddress,
              value: tx.value,
              input: tx.input || '0x',
              gasUsed: gasUsed,
              status: tx.isError === '0' ? 'success' : 'failed',
              network
            };

            // Process transaction (stores in DB and runs analysis)
            // This returns RiskAnalysis which contains findings
            const riskAnalysis = await processTransaction(transaction);
            const { findings } = riskAnalysis;

            // Publish findings to SDS
            for (const finding of findings) {
              await this.publishFindingToSDS(finding, network, transaction.hash);
            }

            // Publish risk score to SDS (threshold: risk >= 30)
            await this.publishRiskScoreToSDS(riskAnalysis, transaction, contractAddress, network);

            // Update stats
            totalGas += BigInt(gasUsed);
            if (tx.isError === '1') failedCount++;
            newTxCount++;
            maxBlock = blockNum > maxBlock ? blockNum : maxBlock;
          }

          // Update contract stats
          if (newTxCount > 0) {
             await prisma.contract.update({
              where: { address: contractAddress },
              data: {
                totalTxs: { increment: newTxCount },
                failedTxs: { increment: failedCount },
                lastProcessedBlock: maxBlock,
                lastActivity: new Date()
              }
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Error polling transactions for ${contractAddress}:`, error);
    }
  }

  /**
   * Publish a finding to SDS as a structured event
   */
  private async publishFindingToSDS(finding: Finding, network: string, txHash: string) {
    try {
      if (!this.securityAlertSchemaId) {
        logger.warn('⚠️ Cannot publish to SDS: Schema ID not registered');
        return;
      }

      logger.debug(`Preparing to publish finding to SDS: ${finding.type} for ${finding.contractAddress}`);

      const sdk = network === 'mainnet' ? this.mainnetSdk : this.testnetSdk;
      const schemaEncoder = new SchemaEncoder(securityAlertSchema);

      // Encode finding data
      const encodedData = schemaEncoder.encodeData([
        { name: 'timestamp', value: BigInt(Date.now()), type: 'uint64' },
        { name: 'contractAddress', value: finding.contractAddress as `0x${string}`, type: 'address' },
        { name: 'txHash', value: (txHash || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`, type: 'bytes32' },
        { name: 'alertType', value: finding.type, type: 'string' },
        { name: 'severity', value: finding.severity, type: 'string' },
        { name: 'description', value: finding.description, type: 'string' },
        { name: 'value', value: BigInt(0), type: 'uint256' }, // We might want to pass value from finding if available
        { name: 'gasUsed', value: BigInt(0), type: 'uint256' }, // Same for gas
        { name: 'confidence', value: Math.floor(finding.ruleConfidence * 100), type: 'uint8' }
      ]);

      // Generate a unique ID for this alert event
      const dataId = toHex(crypto.randomUUID().replace(/-/g, ''), { size: 32 });

      logger.debug(`SDS Payload (Finding): dataId=${dataId}, schemaId=${this.securityAlertSchemaId}`);

      logger.info(`📤 [SDS] Publishing SecurityAlert to SDS...`);
      logger.info(`📤 [SDS] Schema ID: ${this.securityAlertSchemaId}`);
      logger.info(`📤 [SDS] Publisher: ${this.publisherAddress}`);
      logger.info(`📤 [SDS] Data ID: ${dataId}`);
      logger.info(`📤 [SDS] Contract: ${finding.contractAddress}`);
      logger.info(`📤 [SDS] Topics: [${finding.contractAddress}, ${this.publisherAddress}]`);

      // Publish to SDS with event emission
      const sdsTxHash = await sdk.streams.setAndEmitEvents(
        [{ id: dataId, schemaId: this.securityAlertSchemaId as `0x${string}`, data: encodedData }],
        [{
          id: securityAlertEventId,
          argumentTopics: [
            pad(finding.contractAddress as `0x${string}`, { size: 32 }),  // Pad address to bytes32
            pad(this.publisherAddress!, { size: 32 })                      // Pad address to bytes32
          ],
          data: encodeAbiParameters(
            parseAbiParameters('bytes32 dataId'),
            [dataId as `0x${string}`]
          )
        }]
      );

      if (sdsTxHash instanceof Error) {
        logger.error(`❌ [SDS] Failed to publish finding:`, sdsTxHash.message);
        throw sdsTxHash;
      }

      logger.info(`✅ [SDS] Transaction hash: ${sdsTxHash}`);

      logger.info(`📡 Published finding to SDS: ${finding.type} for ${finding.contractAddress}`);
      logger.info(`📍 [SDS] Frontend should query: getByKey("${this.securityAlertSchemaId}", "${this.publisherAddress}", "${dataId}")`);
    } catch (error) {
      logger.error(`Error publishing finding to SDS:`, error);
    }
  }

  /**
   * Publish Risk Score to SDS (Live Risk Feed)
   * Only publishes if risk score >= 30 (MEDIUM or higher)
   */
  private async publishRiskScoreToSDS(
    riskAnalysis: RiskAnalysis,
    tx: { hash: string; from: string; value: string; gasUsed: number },
    contractAddress: string,
    network: string
  ) {
    try {
      // Threshold filter: only publish risk >= 30
      if (riskAnalysis.riskScore < 30) {
        return;
      }

      if (!this.riskScoreSchemaId) {
        logger.warn('⚠️ Cannot publish RiskScore to SDS: Schema ID not registered');
        return;
      }

      logger.debug(`Preparing to publish RiskScore to SDS: Score=${riskAnalysis.riskScore} for ${contractAddress}`);

      const sdk = network === 'mainnet' ? this.mainnetSdk : this.testnetSdk;
      const schemaEncoder = new SchemaEncoder(riskScoreSchema);

      // Encode risk score data
      const encodedData = schemaEncoder.encodeData([
        { name: 'timestamp', value: BigInt(Date.now()), type: 'uint64' },
        { name: 'contractAddress', value: contractAddress as `0x${string}`, type: 'address' },
        { name: 'sender', value: tx.from as `0x${string}`, type: 'address' },
        { name: 'txHash', value: (tx.hash || '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`, type: 'bytes32' },
        { name: 'riskScore', value: riskAnalysis.riskScore, type: 'uint8' },
        { name: 'riskLevel', value: riskAnalysis.riskLevel, type: 'string' },
        { name: 'primaryFactor', value: riskAnalysis.primaryFactor, type: 'string' },
        { name: 'value', value: BigInt(tx.value || '0'), type: 'uint256' },
        { name: 'gasUsed', value: BigInt(tx.gasUsed || 0), type: 'uint256' }
      ]);

      // Generate unique data ID
      const dataId = `0x${randomBytes(32).toString('hex')}` as `0x${string}`;

      logger.debug(`SDS Payload (RiskScore): dataId=${dataId}, schemaId=${this.riskScoreSchemaId}`);

      logger.info(`📤 [RISK] Publishing RiskScore to SDS...`);
      logger.info(`📤 [RISK] Schema ID: ${this.riskScoreSchemaId}`);
      logger.info(`📤 [RISK] Publisher: ${this.publisherAddress}`);
      logger.info(`📤 [RISK] Data ID: ${dataId}`);
      logger.info(`📤 [RISK] Contract: ${contractAddress}`);
      logger.info(`📤 [RISK] Topics: [${contractAddress}, ${this.publisherAddress}]`);

      // Publish to SDS
      const sdsTxHash = await sdk.streams.setAndEmitEvents(
        [{ id: dataId, schemaId: this.riskScoreSchemaId as `0x${string}`, data: encodedData }],
        [{
          id: riskScoreEventId,
          argumentTopics: [
            pad(contractAddress as `0x${string}`, { size: 32 }),  // Pad address to bytes32
            pad(this.publisherAddress!, { size: 32 })               // Pad address to bytes32
          ],
          data: encodeAbiParameters(
            parseAbiParameters('bytes32 dataId'),
            [dataId]
          )
        }]
      );

      if (sdsTxHash instanceof Error) {
        logger.error(`❌ [RISK] Failed to publish risk score:`, sdsTxHash.message);
        throw sdsTxHash;
      }

      logger.info(`✅ [RISK] Transaction hash: ${sdsTxHash}`);

      logger.info(`📊 Published risk score ${riskAnalysis.riskScore} (${riskAnalysis.riskLevel}) for tx ${tx.hash.slice(0, 10)}...`);
      logger.info(`📍 [RISK] Frontend should query: getByKey("${this.riskScoreSchemaId}", "${this.publisherAddress}", "${dataId}")`);
    } catch (error) {
      logger.error(`Error publishing risk score to SDS:`, error);
    }
  }

  /**
   * Retry subscription with exponential backoff
   */
  private async retrySubscription(contractAddress: string, network: string, attempt: number = 1) {
    const maxAttempts = 10;
    const baseDelay = 5000; // 5 seconds

    if (attempt > maxAttempts) {
      logger.error(`❌ Max retry attempts reached for ${contractAddress} on ${network}`);
      await this.handleMonitoringFailure(contractAddress, network, maxAttempts);
      return;
    }

    const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), 60000); // Cap at 60s
    logger.info(`🔄 Retrying subscription for ${contractAddress} in ${delay/1000}s (Attempt ${attempt}/${maxAttempts})...`);

    const timeout = setTimeout(() => {
      this.startMonitoring(contractAddress, network);
    }, delay);

    this.retryTimeouts.set(contractAddress, timeout);
  }

  /**
   * Handle monitoring failure after max retries
   * Creates alerts, updates contract status, and tracks failed monitor
   */
  private async handleMonitoringFailure(contractAddress: string, network: string, attempts: number) {
    try {
      // Update contract status to 'error'
      await prisma.contract.update({
        where: { address: contractAddress },
        data: {
          status: 'error',
          statusMessage: `Failed to establish SDS subscription after ${attempts} attempts`
        }
      });

      // Create critical alert
      await prisma.alert.create({
        data: {
          severity: 'CRITICAL',
          type: 'MONITORING_FAILURE',
          contractAddress,
          description: `Monitoring failed for contract ${contractAddress} after ${attempts} retry attempts. Contract is no longer being monitored.`,
          recommendation: 'Check network connectivity and SDS service status. Try restarting monitoring from the dashboard.',
          dismissed: false
        }
      });

      // Track failed monitor for admin visibility
      await prisma.failedMonitor.create({
        data: {
          contractAddress,
          network,
          reason: 'MAX_RETRIES_EXCEEDED',
          attempts,
          lastAttempt: new Date(),
          resolved: false
        }
      });

      // Emit WebSocket notification to frontend
      if (this.io) {
        this.io.emit('monitoring_failure', {
          contractAddress,
          network,
          message: 'Monitoring failed - contract no longer monitored',
          severity: 'CRITICAL',
          attempts
        });
      }

      logger.error(`🚨 Monitoring failure tracked for ${contractAddress} on ${network}`);
    } catch (error) {
      logger.error(`Error handling monitoring failure for ${contractAddress}:`, error);
    }
  }

  /**
   * Get initial transaction count from Explorer API (preferred) or RPC (fallback)
   */
  /**
   * Backfill historical transactions from Explorer API
   * Only processes transactions AFTER lastProcessedBlock to prevent double-counting on restart
   */
  private async backfillHistory(contractAddress: string, network: string): Promise<number> {
    try {
      // Get current contract state to check lastProcessedBlock
      const contract = await prisma.contract.findUnique({
        where: { address: contractAddress },
        select: { lastProcessedBlock: true, totalTxs: true }
      });

      const lastBlock = contract?.lastProcessedBlock || BigInt(0);
      const explorerUrl = network === 'mainnet'
        ? 'https://explorer.somnia.network'
        : 'https://shannon-explorer.somnia.network';

      // Only fetch transactions AFTER lastProcessedBlock
      const startBlock = lastBlock > BigInt(0) ? lastBlock.toString() : '0';
      const response = await fetch(
        `${explorerUrl}/api?module=account&action=txlist&address=${contractAddress}&startblock=${startBlock}`
      );

      if (response.ok) {
        const data = await response.json() as any;
        if (data.status === '1' && Array.isArray(data.result)) {
          // Filter out transactions we've already processed
          const newTransactions = data.result.filter((tx: any) =>
            BigInt(tx.blockNumber) > lastBlock
          );

          logger.info(
            `✅ Fetched ${data.result.length} historical txs for ${contractAddress}, ` +
            `${newTransactions.length} new (after block ${lastBlock})`
          );

          // Store NEW transactions only
          let totalGas = BigInt(0);
          let failedCount = 0;
          let maxBlock = lastBlock;
          let newTxCount = 0;

          for (const tx of newTransactions) {
            const blockNum = BigInt(tx.blockNumber);
            const gasUsed = parseInt(tx.gasUsed);

            totalGas += BigInt(gasUsed);
            if (tx.isError === '1') failedCount++;

            // Use upsert to handle duplicates gracefully
            await prisma.transaction.upsert({
              where: { hash: tx.hash },
              update: {}, // Skip if already exists
              create: {
                hash: tx.hash,
                from: tx.from,
                to: tx.to || contractAddress,
                value: tx.value,
                gasUsed: gasUsed,
                status: tx.isError === '0' ? 'success' : 'failed',
                timestamp: new Date(parseInt(tx.timeStamp) * 1000),
                contractAddress: contractAddress,
                blockNumber: blockNum
              }
            });

            newTxCount++;
            maxBlock = blockNum > maxBlock ? blockNum : maxBlock;
          }

          // Update contract stats - INCREMENT by NEW transactions only
          if (newTxCount > 0) {
            const avgGas = newTxCount > 0
              ? Number(totalGas / BigInt(newTxCount))
              : 0;

            await prisma.contract.update({
              where: { address: contractAddress },
              data: {
                totalTxs: { increment: newTxCount },  // ✓ Increment by NEW txs only
                failedTxs: { increment: failedCount },
                avgGas: avgGas,
                lastProcessedBlock: maxBlock  // ✓ Track last processed block
              }
            });

            // TRIGGER BACKFILL ANALYSIS: Analyze ALL new transactions in background
            // Run asynchronously to avoid blocking contract addition
            setImmediate(() => {
              this.analyzeBackfilledTransactions(contractAddress, network, newTransactions)
                .catch(error => {
                  logger.error(`Background analysis failed for ${contractAddress}:`, error);
                });
            });
          }

          return (contract?.totalTxs || 0) + newTxCount;  // Return total count
        }
      }

      logger.warn('Explorer API failed or returned no data, falling back to RPC nonce');
    } catch (error) {
      logger.error('Error backfilling history:', error);
    }

    // Fallback to RPC Nonce (only outgoing txs)
    try {
      const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;
      const count = await client.getTransactionCount({
        address: contractAddress as `0x${string}`
      });
      return count;
    } catch (error) {
      logger.error(`Error fetching initial tx count for ${contractAddress}:`, error);
      return 0;
    }
  }

  /**
   * Analyze backfilled historical transactions
   * Runs in background to analyze ALL transactions for completeness
   * Updates contract status and creates findings
   */
  private async analyzeBackfilledTransactions(
    contractAddress: string,
    network: string,
    transactions: any[]
  ): Promise<void> {
    if (transactions.length === 0) {
      logger.info(`No transactions to analyze for ${contractAddress}`);
      return;
    }

    logger.info(
      `📊 Starting analysis of ${transactions.length} backfilled transactions for ${contractAddress}`
    );

    let analyzedCount = 0;
    let findingsCount = 0;

    try {
      // Update contract status to "analyzing"
      await prisma.contract.update({
        where: { address: contractAddress },
        data: {
          status: 'analyzing',
          statusMessage: `Analyzing ${transactions.length} historical transactions...`
        }
      });

      // Create placeholder alert
      const placeholderAlert = await prisma.alert.create({
        data: {
          severity: 'INFO',
          type: 'SYSTEM',
          contractAddress,
          description: `Checking older transactions... (0/${transactions.length})`,
          recommendation: 'Please wait while we analyze historical activity.',
          dismissed: false
        }
      });

      // Analyze ALL transactions (per user requirement for completeness)
      for (const tx of transactions) {
        try {
          // Check if transaction already exists (avoid duplicate analysis)
          const existingTx = await prisma.transaction.findUnique({
            where: { hash: tx.hash }
          });

          if (!existingTx) {
            logger.debug(`Transaction ${tx.hash} not found in DB during backfill analysis, skipping`);
            continue;
          }

          const transaction = {
            hash: tx.hash,
            from: tx.from,
            to: tx.to || contractAddress,
            value: tx.value,
            input: '0x', // Historical txs from Explorer API may not include input
            gasUsed: parseInt(tx.gasUsed),
            status: tx.isError === '0' ? 'success' : 'failed',
            network
          };

          // Analyze transaction using rule engine
          const riskAnalysis = await analyzeTransaction(transaction);
          const { findings } = riskAnalysis;

          // Store findings (transaction already stored by backfill)
          for (const finding of findings) {
            // Check for duplicate findings (prevent double-creation)
            const existingFinding = await prisma.finding.findFirst({
              where: {
                contractAddress: finding.contractAddress,
                type: finding.type,
                description: finding.description,
                createdAt: { gte: new Date(Date.now() - 60000) } // within last minute
              }
            });

            if (existingFinding) {
              logger.debug(`Duplicate finding detected for ${finding.type}, skipping`);
              continue;
            }

            const createdFinding = await prisma.finding.create({
              data: {
                contractAddress: finding.contractAddress,
                type: finding.type,
                severity: finding.severity,
                line: finding.line,
                functionName: finding.functionName,
                codeSnippet: finding.codeSnippet,
                ruleConfidence: finding.ruleConfidence,
                description: finding.description,
                validated: false
              }
            });

            // Queue for LLM validation with priority
            const priority = finding.severity === 'CRITICAL' ? 'high' :
                             finding.severity === 'HIGH' ? 'medium' : 'low';
            await queueValidation(createdFinding, priority);

            findingsCount++;
          }

          analyzedCount++;

          // Update placeholder alert progress every 10 transactions
          if (analyzedCount % 10 === 0) {
            await prisma.alert.update({
              where: { id: placeholderAlert.id },
              data: {
                description: `Checking older transactions... (${analyzedCount}/${transactions.length})`
              }
            });

            logger.info(`  📊 Progress: Analyzed ${analyzedCount}/${transactions.length} transactions, found ${findingsCount} issues`);
          }

          // Emit progress to frontend
          if (this.io) {
            this.io.emit('backfill_analysis_progress', {
              contractAddress,
              analyzed: analyzedCount,
              total: transactions.length,
              findings: findingsCount
            });
          }
        } catch (error) {
          logger.error(`  ✗ Error analyzing backfilled tx ${tx.hash}:`, error);
        }
      }

      // Remove placeholder alert
      await prisma.alert.delete({
        where: { id: placeholderAlert.id }
      });

      // Update contract status to "healthy"
      await prisma.contract.update({
        where: { address: contractAddress },
        data: {
          status: 'healthy',
          statusMessage: null
        }
      });

      logger.info(
        `✅ Backfill analysis complete for ${contractAddress}: ` +
        `${analyzedCount}/${transactions.length} transactions analyzed, ${findingsCount} findings created`
      );

      // Emit completion event
      if (this.io) {
        this.io.emit('backfill_analysis_complete', {
          contractAddress,
          analyzed: analyzedCount,
          total: transactions.length,
          findings: findingsCount
        });
      }
    } catch (error) {
      logger.error(`Error during backfill analysis for ${contractAddress}:`, error);

      // Update contract status to error
      await prisma.contract.update({
        where: { address: contractAddress },
        data: {
          status: 'error',
          statusMessage: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    }
  }

  /**
   * Stop monitoring a contract
   * Cleanup: WebSocket watchers, polling intervals, reconnection timers
   */
  async stopMonitoring(contractAddress: string) {
    logger.info(`🛑 Stopping monitoring for ${contractAddress}`);

    // 1. Clear retry timeout if exists
    if (this.retryTimeouts.has(contractAddress)) {
      clearTimeout(this.retryTimeouts.get(contractAddress));
      this.retryTimeouts.delete(contractAddress);
      logger.debug(`  ✓ Cleared retry timeout for ${contractAddress}`);
    }

    // 2. Stop WebSocket block watcher
    const unwatch = this.blockWatchers.get(contractAddress);
    if (unwatch) {
      unwatch(); // Call unwatch function to stop listening
      this.blockWatchers.delete(contractAddress);
      this.watcherHealth.delete(contractAddress);
      logger.info(`  ✓ Stopped WebSocket watcher for ${contractAddress}`);
    }

    // 3. Clear polling interval
    if (this.pollingIntervals.has(contractAddress)) {
      clearInterval(this.pollingIntervals.get(contractAddress));
      this.pollingIntervals.delete(contractAddress);
      logger.info(`  ✓ Stopped polling for ${contractAddress}`);
    }

    // 4. Clear reconnection timer
    if (this.reconnectionTimers.has(contractAddress)) {
      clearTimeout(this.reconnectionTimers.get(contractAddress));
      this.reconnectionTimers.delete(contractAddress);
      logger.debug(`  ✓ Cleared reconnection timer for ${contractAddress}`);
    }

    // 5. Clear fallback status
    this.fallbackActive.delete(contractAddress);

    // 6. Clear SDS subscription if any (legacy)
    const sub = this.subscriptions.get(contractAddress);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(contractAddress);
      logger.debug(`  ✓ Cleared legacy SDS subscription for ${contractAddress}`);
    }

    logger.info(`✅ Monitoring stopped for ${contractAddress}`);
  }

  /**
   * Handle contract event from SDS
   */
  private async handleContractEvent(data: any, contractAddress: string, network: string) {
    if (this.isPaused) return;

    try {
      // DEBUG LOGGING: Track event count per contract for first 10 events only
      const debugKey = `debug_${contractAddress}`;
      let eventCount = this.debugEventCounts.get(debugKey) || 0;
      
      // Only track and log first 10 events per contract to prevent memory leak
      if (eventCount < 10) {
        this.debugEventCounts.set(debugKey, eventCount + 1);
        logger.info(`🔍 [DEBUG ${eventCount + 1}/10] SDS Event for ${contractAddress} (${network}):`);
        logger.info(JSON.stringify(data, null, 2));
      }


      // SDS event structure can vary, try multiple paths
      // 1. data.result.transactionHash (standard)
      // 2. data.transactionHash (direct)
      // 3. data.log?.transactionHash (log event)
      // 4. data[0]?.transactionHash (array)
      // 5. data.receipt?.transactionHash (receipt)
      // 6. data.block?.transactions[] (block with embedded txs)

      let txHash = data.result?.transactionHash ||
                   data.transactionHash ||
                   data.log?.transactionHash;

      if (!txHash && Array.isArray(data) && data.length > 0) {
        txHash = data[0]?.transactionHash || data[0]?.result?.transactionHash;
      }

      // Check for receipt-based events
      if (!txHash && data.receipt?.transactionHash) {
        txHash = data.receipt.transactionHash;
        logger.debug(`📝 Found txHash in receipt: ${txHash}`);
      }

      // Check for block events with embedded transactions
      if (!txHash && data.block?.transactions && Array.isArray(data.block.transactions)) {
        logger.debug(`📦 Block event received with ${data.block.transactions.length} transactions`);
        // Process each transaction in the block that matches our contract
        for (const tx of data.block.transactions) {
          if (tx.to?.toLowerCase() === contractAddress.toLowerCase() ||
              tx.from?.toLowerCase() === contractAddress.toLowerCase()) {
            await this.processTransactionFromEvent(tx, contractAddress, network);
          }
        }
        return;
      }

      if (!txHash) {
        // Enhanced non-transaction event logging with type tracking
        const eventType = data.type || data.event || data.result?.type || 'unknown';
        const eventKeys = Object.keys(data).join(', ');

        logger.debug(
          `📡 Non-transaction event from ${contractAddress} (${network}): ` +
          `Type=${eventType}, Keys=[${eventKeys}]`
        );

        // Track event type statistics
        this.trackEventType(eventType, contractAddress);

        // Check if this is a simulation result or other non-transaction event
        if (data.simulationResults || data.result?.simulationResults) {
          logger.debug('Event contains simulation results, skipping transaction processing');
        } else if (eventCount < 10) {
          logger.warn(`⚠️  Unknown event type from ${contractAddress}, no transaction hash found`);
        }
        return;
      }

      logger.info(`📡 Processing transaction ${txHash} from ${contractAddress} (${network})`);

      // Check for duplicate transaction to prevent reprocessing
      const existingTx = await prisma.transaction.findUnique({
        where: { hash: txHash }
      });

      if (existingTx) {
        logger.debug(`Duplicate transaction ${txHash} detected, skipping processing`);
        return;
      }

      // Use correct client for fetching tx details
      const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;

      const tx = await client.getTransaction({ hash: txHash });
      const receipt = await client.getTransactionReceipt({ hash: txHash });

      const transaction = {
        hash: txHash,
        from: tx.from,
        to: tx.to || contractAddress,
        value: tx.value.toString(),
        input: tx.input,
        gasUsed: Number(receipt.gasUsed),
        status: receipt.status === 'success' ? 'success' : 'failed',
        network // Add network to transaction data
      };

      // Process through rule engine
      const riskAnalysis = await processTransaction(transaction);
      const { findings } = riskAnalysis;

      // Validate findings with LLM if any were detected
      if (findings.length > 0) {
        logger.info(`🔍 Found ${findings.length} potential vulnerabilities in tx ${txHash}`);
        // await validateFindings(findings); // Disabled auto-validation

        // Emit findings to frontend for manual validation
        if (this.io) {
          findings.forEach(finding => {
            this.io.emit('new_finding', finding);
          });
        }
      }

      // Update contract stats
      await this.updateContractStats(contractAddress, transaction);

      // Emit real-time event
      if (this.io) {
        this.io.emit('new_transaction', {
          contractAddress,
          transaction
        });
      }
    } catch (error) {
      logger.error('Error handling contract event:', error);
    }
  }

  /**
   * Process transaction from block event
   * Helper method for handling transactions embedded in block events
   */
  private async processTransactionFromEvent(
    txData: any,
    contractAddress: string,
    network: string
  ): Promise<void> {
    try {
      const txHash = txData.hash;

      if (!txHash) {
        logger.debug('Transaction in block event has no hash, skipping');
        return;
      }

      // Check for duplicate
      const existingTx = await prisma.transaction.findUnique({
        where: { hash: txHash }
      });

      if (existingTx) {
        logger.debug(`Duplicate transaction ${txHash} detected, skipping`);
        return;
      }

      const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;

      // Fetch full transaction details
      const tx = await client.getTransaction({ hash: txHash });
      const receipt = await client.getTransactionReceipt({ hash: txHash });

      const transaction = {
        hash: txHash,
        from: tx.from,
        to: tx.to || contractAddress,
        value: tx.value.toString(),
        input: tx.input,
        gasUsed: Number(receipt.gasUsed),
        status: receipt.status === 'success' ? 'success' : 'failed',
        network
      };

      // Process through rule engine
      const riskAnalysis = await processTransaction(transaction);
      const { findings } = riskAnalysis;

      // Validate findings with LLM if any were detected
      if (findings.length > 0) {
        logger.info(`🔍 Found ${findings.length} potential vulnerabilities in tx ${txHash}`);

        // Emit findings to frontend for manual validation
        if (this.io) {
          findings.forEach(finding => {
            this.io.emit('new_finding', finding);
          });
        }
      }

      // Update contract stats
      await this.updateContractStats(contractAddress, transaction);

      // Emit real-time event
      if (this.io) {
        this.io.emit('new_transaction', {
          contractAddress,
          transaction
        });
      }
    } catch (error) {
      logger.error(`Error processing transaction from block event:`, error);
    }
  }

  /**
   * Track event type statistics for diagnostics
   */
  private trackEventType(type: string, contractAddress: string): void {
    const key = `${contractAddress}:${type}`;
    const current = this.eventTypeStats.get(key) || { count: 0, lastSeen: new Date() };
    this.eventTypeStats.set(key, {
      count: current.count + 1,
      lastSeen: new Date()
    });

    // Log every 100 events of each type
    if (current.count > 0 && current.count % 100 === 0) {
      logger.info(`📊 Event stats: ${type} for ${contractAddress} = ${current.count} events`);
    }
  }

  /**
   * Get event type statistics for monitoring
   */
  getEventStats() {
    const stats: any = {};
    for (const [key, value] of this.eventTypeStats.entries()) {
      stats[key] = {
        count: value.count,
        lastSeen: value.lastSeen.toISOString()
      };
    }
    return stats;
  }

  /**
   * Update contract statistics with atomic database operations
   * Uses Prisma transactions to prevent race conditions during concurrent updates
   */
  private async updateContractStats(contractAddress: string, tx: any) {
    try {
      // Option 1: Use Prisma transaction with serializable isolation level
      // This ensures atomic read-calculate-write operations
      await prisma.$transaction(async (prismaClient) => {
        const contract = await prismaClient.contract.findUnique({
          where: { address: contractAddress },
          select: { totalTxs: true, avgGas: true }
        });

        if (!contract) return;

        // Calculate new average gas
        // New Avg = ((Old Avg * Old Count) + New Gas) / (Old Count + 1)
        const currentTxs = contract.totalTxs;
        const currentAvg = contract.avgGas;
        const newGas = tx.gasUsed;

        const newAvgGas = Math.round(
          ((currentAvg * currentTxs) + newGas) / (currentTxs + 1)
        );

        // Update with atomic increments
        await prismaClient.contract.update({
          where: { address: contractAddress },
          data: {
            totalTxs: { increment: 1 },
            failedTxs: tx.status === 'failed' ? { increment: 1 } : undefined,
            avgGas: newAvgGas,
            lastActivity: new Date()
          }
        });
      }, {
        isolationLevel: 'Serializable',  // Strongest isolation to prevent race conditions
        timeout: 5000,  // 5 second timeout
        maxWait: 3000   // Max 3 seconds wait for transaction to start
      });

      // Fetch updated contract after transaction completes
      const updatedContract = await prisma.contract.findUnique({
        where: { address: contractAddress },
        include: {
          findings: true,
          alerts: true
        }
      });

      if (!updatedContract) return;

      logger.info(`✅ Contract stats updated atomically for ${contractAddress}. Total Txs: ${updatedContract.totalTxs}`);

      if (this.io) {
        this.io.emit('contract_update', serializeBigInt(updatedContract));
        logger.info(`📡 Emitted contract_update event for ${contractAddress}`);
      }
    } catch (error: any) {
      logger.error('Error updating contract stats:', error);

      // Retry once on write conflict
      if (error.code === 'P2034') {  // Prisma write conflict error
        logger.warn(`Write conflict detected for ${contractAddress}, retrying...`);
        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        // Retry the update once
        try {
          await this.updateContractStats(contractAddress, tx);
        } catch (retryError) {
          logger.error(`Retry failed for ${contractAddress}:`, retryError);
        }
      }
    }
  }

  /**
   * Toggle global monitoring pause state
   */
  togglePause(paused?: boolean) {
    this.isPaused = paused !== undefined ? paused : !this.isPaused;
    logger.info(`Global monitoring ${this.isPaused ? 'PAUSED' : 'RESUMED'}`);
    return this.isPaused;
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.subscriptions.size > 0,
      isPaused: this.isPaused,
      monitoredContracts: Array.from(this.subscriptions.keys()),
      activeSubscriptions: this.subscriptions.size
    };
  }

  /**
   * Get detailed monitoring health information
   * Includes failed monitors and retry status
   */
  async getMonitoringHealth() {
    // Get failed monitors from database
    const failedMonitors = await prisma.failedMonitor.findMany({
      where: { resolved: false },
      orderBy: { lastAttempt: 'desc' }
    });

    return {
      activeSubscriptions: this.subscriptions.size,
      failedSubscriptions: failedMonitors.length,
      retryingSubscriptions: this.retryTimeouts.size,
      isPaused: this.isPaused,
      monitoredContracts: Array.from(this.subscriptions.keys()),
      failedMonitors: failedMonitors.map(fm => ({
        contractAddress: fm.contractAddress,
        network: fm.network,
        reason: fm.reason,
        attempts: fm.attempts,
        lastAttempt: fm.lastAttempt
      }))
    };
  }
}

// Export singleton instance
export const sdsMonitor = new SDSMonitor();
