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
    default: { http: [process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'] },
    public: { http: [process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'] }
  }
});

class SDSMonitor {
  private sdk: SDK;
  private subscriptions: Map<string, { subscriptionId: string, unsubscribe: () => void }> = new Map();

  constructor() {
    // Use WebSocket transport for subscriptions (required by SDS)
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: webSocket(process.env.SOMNIA_WS_URL || 'wss://dream-rpc.somnia.network')
    });

    // Only create wallet client if private key is available
    let walletClient = undefined;
    if (process.env.PRIVATE_KEY) {
      const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
      walletClient = createWalletClient({
        chain: somniaTestnet,
        account,
        transport: http()
      });
    }

    this.sdk = new SDK({
      public: publicClient,
      wallet: walletClient
    });
  }

  /**
   * Start monitoring a contract using SDS subscription
   * Subscribes to ALL events from the contract
   */
  async startMonitoring(contractAddress: string) {
    console.log(`Starting SDS monitoring for contract: ${contractAddress}`);

    try {
      // Subscribe to ALL events from this contract
      // Using eventContractSource to monitor any contract on Somnia
      const subscription = await this.sdk.streams.subscribe({
        somniaStreamsEventId: undefined, // null for custom event source
        eventContractSource: contractAddress as `0x${string}`, // The contract to monitor
        topicOverrides: [], // Empty = subscribe to ALL events from this contract
        ethCalls: [], // No additional calls needed
        onData: async (data: any) => {
          await this.handleContractEvent(data, contractAddress);
        },
        onError: (error: Error) => {
          console.error(`SDS subscription error for ${contractAddress}:`, error);
        },
        onlyPushChanges: false
      });

      if (subscription) {
        this.subscriptions.set(contractAddress, subscription);
        console.log(`✅ SDS subscription active for ${contractAddress}`);
      }

      // Update contract status
      await prisma.contract.update({
        where: { address: contractAddress },
        data: { status: 'healthy' }
      });
    } catch (error) {
      console.error(`Error starting SDS monitoring for ${contractAddress}:`, error);
    }
  }

  /**
   * Stop monitoring a contract
   */
  async stopMonitoring(contractAddress: string) {
    const subscription = this.subscriptions.get(contractAddress);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(contractAddress);
      console.log(`Stopped SDS monitoring for ${contractAddress}`);
    }
  }

  /**
   * Handle contract event from SDS
   * This is called for EVERY event emitted by the monitored contract
   */
  private async handleContractEvent(data: any, contractAddress: string) {
    try {
      console.log(`📡 Received event from ${contractAddress}:`, data);

      // Extract transaction data from event
      // The event data contains: topics, data, transactionHash, blockNumber, etc.
      const txHash = data.result?.transactionHash || data.transactionHash;
      
      if (!txHash) {
        console.warn('No transaction hash in event data');
        return;
      }

      // Fetch full transaction details using viem
      const tx = await this.sdk.public.getTransaction({ hash: txHash });
      const receipt = await this.sdk.public.getTransactionReceipt({ hash: txHash });

      const transaction = {
        hash: txHash,
        from: tx.from,
        to: tx.to || contractAddress,
        value: tx.value.toString(),
        input: tx.input,
        gasUsed: Number(receipt.gasUsed),
        status: receipt.status === 'success' ? 'success' : 'failed'
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
