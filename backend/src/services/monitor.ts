import { SDK } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, http, webSocket } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import prisma from '../db/prisma.js';
import { processTransaction } from '../rules/engine.js';
import { validateFindings } from '../llm/validator.js';

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
  
  // Map<contractAddress, { subscription, network }>
  private subscriptions: Map<string, { subscriptionId: string, unsubscribe: () => void, network: string }> = new Map();

  constructor() {
    // --- Testnet Setup ---
    const testnetWsUrl = process.env.SOMNIA_TESTNET_WS_URL || 'wss://dream-rpc.somnia.network/ws';
    this.testnetClient = createPublicClient({
      chain: somniaTestnet,
      transport: webSocket(testnetWsUrl)
    });

    this.testnetSdk = new SDK({
      public: this.testnetClient
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
  }

  /**
   * Start monitoring a contract using SDS subscription
   * @param contractAddress The address to monitor
   * @param network 'testnet' or 'mainnet' (default: 'testnet')
   */
  async startMonitoring(contractAddress: string, network: string = 'testnet') {
    console.log(`Starting SDS monitoring for ${contractAddress} on ${network}`);

    try {
      const sdk = network === 'mainnet' ? this.mainnetSdk : this.testnetSdk;

      // Subscribe to ALL events from this contract
      const subscription = await sdk.streams.subscribe({
        somniaStreamsEventId: undefined, 
        // @ts-ignore
        eventContractSources: [contractAddress as `0x${string}`], 
        topicOverrides: [], 
        ethCalls: [], 
        onData: async (data: any) => {
          await this.handleContractEvent(data, contractAddress, network);
        },
        onError: (error: Error) => {
          console.error(`SDS subscription error for ${contractAddress} (${network}):`, error);
        },
        onlyPushChanges: false
      });

      if (subscription && !(subscription instanceof Error)) {
        this.subscriptions.set(contractAddress, { ...subscription, network });
        console.log(`✅ SDS subscription active for ${contractAddress} on ${network}`);
      } else if (subscription instanceof Error) {
        console.error(`❌ Failed to subscribe: ${subscription.message}`);
      } else {
        console.error(`❌ Failed to subscribe: Unknown error`);
      }

      // Update contract status and backfill transaction count
      const initialTxCount = await this.getInitialTransactionCount(contractAddress, network);
      console.log(`🔢 Initial transaction count for ${contractAddress}: ${initialTxCount}`);

      await prisma.contract.update({
        where: { address: contractAddress },
        data: { 
          status: 'healthy', 
          network,
          totalTxs: {
            // Only set if current is 0 (to avoid overwriting if we restart monitoring)
            increment: initialTxCount 
          }
        }
      });
    } catch (error) {
      console.error(`Error starting SDS monitoring for ${contractAddress}:`, error);
    }
  }

  /**
   * Get initial transaction count from Explorer API (preferred) or RPC (fallback)
   */
  private async getInitialTransactionCount(contractAddress: string, network: string): Promise<number> {
    try {
      // Try Explorer API first for total interactions (incoming + outgoing)
      const explorerUrl = network === 'mainnet' 
        ? 'https://explorer.somnia.network' 
        : 'https://shannon-explorer.somnia.network';
      
      const response = await fetch(`${explorerUrl}/api?module=account&action=txlist&address=${contractAddress}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === '1' && Array.isArray(data.result)) {
          console.log(`✅ Fetched ${data.result.length} txs from Explorer API`);
          return data.result.length;
        }
      }
      
      console.warn('Explorer API failed or returned no data, falling back to RPC nonce');
    } catch (error) {
      console.error('Error fetching from Explorer API:', error);
    }

    // Fallback to RPC Nonce (only outgoing txs)
    try {
      const client = network === 'mainnet' ? this.mainnetClient : this.testnetClient;
      const count = await client.getTransactionCount({
        address: contractAddress as `0x${string}`
      });
      return count;
    } catch (error) {
      console.error(`Error fetching initial tx count for ${contractAddress}:`, error);
      return 0;
    }
  }

  /**
   * Stop monitoring a contract
   */
  async stopMonitoring(contractAddress: string) {
    const sub = this.subscriptions.get(contractAddress);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(contractAddress);
      console.log(`Stopped SDS monitoring for ${contractAddress}`);
    }
  }

  /**
   * Handle contract event from SDS
   */
  private async handleContractEvent(data: any, contractAddress: string, network: string) {
    try {
      console.log(`📡 Received event from ${contractAddress} (${network}):`, data);

      const txHash = data.result?.transactionHash || data.transactionHash;
      
      if (!txHash) {
        console.warn('No transaction hash in event data');
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
      const findings = await processTransaction(transaction);

      // Validate findings with LLM if any were detected
      if (findings.length > 0) {
        console.log(`🔍 Found ${findings.length} potential vulnerabilities in tx ${txHash}`);
        await validateFindings(findings);
      }

      // Update contract stats
      await this.updateContractStats(contractAddress, transaction);
    } catch (error) {
      console.error('Error handling contract event:', error);
    }
  }

  /**
   * Update contract statistics
   */
  private async updateContractStats(contractAddress: string, tx: any) {
    try {
      await prisma.contract.update({
        where: { address: contractAddress },
        data: {
          totalTxs: { increment: 1 },
          failedTxs: tx.status === 'failed' ? { increment: 1 } : undefined,
          lastActivity: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating contract stats:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.subscriptions.size > 0,
      monitoredContracts: Array.from(this.subscriptions.keys()),
      activeSubscriptions: this.subscriptions.size
    };
  }
}

// Export singleton instance
export const sdsMonitor = new SDSMonitor();
