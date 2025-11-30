import { useEffect, useState } from 'react';
import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, webSocket, parseAbiParameters, decodeAbiParameters, getAddress, defineChain } from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public: { http: ['https://dream-rpc.somnia.network'] },
  },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://somnia-testnet.socialscan.io' },
  },
  testnet: true,
});

const riskScoreSchema = `uint64 timestamp, address contractAddress, address sender, bytes32 txHash, uint8 riskScore, string riskLevel, string primaryFactor, uint256 value, uint256 gasUsed`;
const riskScoreEventId = 'RiskScore';

/**
 * Real-time Risk Score from Somnia Data Streams
 * Published for transactions with risk >= 30 (MEDIUM or higher)
 */
export interface RiskScore {
  timestamp: number;
  contractAddress: string;
  sender: string;
  txHash: string;
  riskScore: number;
  riskLevel: string; // SAFE, LOW, MEDIUM, HIGH, CRITICAL
  primaryFactor: string;
  value: string;
  gasUsed: string;
}

interface UseRiskScoresOptions {
  contractAddress?: string; // Optional: filter by specific contract
  maxScores?: number; // Maximum scores to keep in memory (default: 100)
}

/**
 * Subscribe to real-time risk scores via Somnia Data Streams
 *
 * @example
 * ```tsx
 * const { riskScores, isConnected, error } = useRiskScores();
 *
 * // Filter by contract
 * const { riskScores } = useRiskScores({
 *   contractAddress: '0x123...',
 *   maxScores: 50
 * });
 * ```
 */
export function useRiskScores(options: UseRiskScoresOptions = {}) {
  const { contractAddress, maxScores = 100 } = options;

  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createPublicClient({
      chain: somniaTestnet,
      transport: webSocket('wss://dream-rpc.somnia.network/ws')
    });

    const sdk = new SDK({ public: client as any });

    const initSubscription = async () => {
      try {
        // Compute schema ID for decoding
        const schemaId = await sdk.streams.computeSchemaId(riskScoreSchema);
        if (schemaId instanceof Error) throw schemaId;

        console.log('📊 Subscribing to Risk Score events:', riskScoreEventId);

        await sdk.streams.subscribe({
          somniaStreamsEventId: riskScoreEventId,
          ethCalls: [],
          onlyPushChanges: false,
          onData: async (data: any) => {
            console.log('📥 Received RiskScore event:', data);
            try {
              // Extract dataId from event data
              const eventData = data.result.data;
              const decodedEvent = decodeAbiParameters(
                parseAbiParameters('bytes32 dataId'),
                eventData
              );
              const dataId = decodedEvent[0];

              // Extract contractAddress and sender from topics
              // Topic 0: Event Sig, Topic 1: contractAddress (indexed), Topic 2: sender (indexed)
              const topics = data.result.topics;
              if (!topics || topics.length < 3) {
                console.warn('⚠️  Received event with insufficient topics');
                return;
              }

              const eventContractAddress = getAddress('0x' + topics[1].slice(26));
              const eventSender = getAddress('0x' + topics[2].slice(26));

              // Filter by contract address if specified
              if (contractAddress && eventContractAddress.toLowerCase() !== contractAddress.toLowerCase()) {
                console.debug(`Filtered out risk score for ${eventContractAddress} (not ${contractAddress})`);
                return;
              }

              console.log(`📡 Fetching risk data for ID ${dataId} (contract: ${eventContractAddress})`);

              // Fetch the data stream
              const streamData = await sdk.streams.getByKey(schemaId, eventSender, dataId);

              if (streamData instanceof Error) {
                console.error('❌ Error fetching stream data:', streamData);
                return;
              }

              if (Array.isArray(streamData) && streamData.length > 0) {
                // Assuming the first item is our data
                const item = streamData[0];

                // If it's already decoded (SchemaDecodedItem[])
                if (Array.isArray(item) && typeof item[0] === 'object' && 'name' in item[0]) {
                   const decodedItem = item as any[]; // SchemaDecodedItem[]

                   const riskScore: RiskScore = {
                     timestamp: Number(decodedItem.find((p: any) => p.name === 'timestamp')?.value ?? 0),
                     contractAddress: decodedItem.find((p: any) => p.name === 'contractAddress')?.value as string,
                     sender: decodedItem.find((p: any) => p.name === 'sender')?.value as string,
                     txHash: decodedItem.find((p: any) => p.name === 'txHash')?.value as string,
                     riskScore: Number(decodedItem.find((p: any) => p.name === 'riskScore')?.value ?? 0),
                     riskLevel: decodedItem.find((p: any) => p.name === 'riskLevel')?.value as string,
                     primaryFactor: decodedItem.find((p: any) => p.name === 'primaryFactor')?.value as string,
                     value: decodedItem.find((p: any) => p.name === 'value')?.value?.toString() ?? '0',
                     gasUsed: decodedItem.find((p: any) => p.name === 'gasUsed')?.value?.toString() ?? '0'
                   };

                   console.log(`✅ Risk Score ${riskScore.riskScore} (${riskScore.riskLevel}) for tx ${riskScore.txHash.slice(0, 10)}...`);

                   // Add to state, keeping latest N scores
                   setRiskScores(prev => [riskScore, ...prev].slice(0, maxScores));
                }
              }
            } catch (e) {
              console.error('❌ Error processing risk score:', e);
            }
          }
        });

        setIsConnected(true);
        console.log('✅ Risk Score subscription active');
      } catch (err) {
        console.error('❌ Failed to subscribe to risk scores:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsConnected(false);
      }
    };

    initSubscription();

    // Cleanup on unmount
    return () => {
      setIsConnected(false);
    };
  }, [contractAddress, maxScores]);

  return {
    riskScores,
    isConnected,
    error,
    // Utility functions
    getHighRiskScores: () => riskScores.filter(s => s.riskScore >= 65),
    getCriticalRiskScores: () => riskScores.filter(s => s.riskScore >= 80),
    getRiskScoresByContract: (address: string) =>
      riskScores.filter(s => s.contractAddress.toLowerCase() === address.toLowerCase())
  };
}
