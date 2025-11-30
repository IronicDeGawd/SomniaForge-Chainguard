import { useEffect, useState } from 'react';
import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, http, webSocket, parseAbiParameters, decodeAbiParameters, getAddress, defineChain } from 'viem';

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

export interface RiskScore {
  timestamp: number;
  contractAddress: string;
  sender: string;
  txHash: string;
  riskScore: number;
  riskLevel: string;
  primaryFactor: string;
  value: string;
  gasUsed: string;
}

export function useRiskScores() {
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔧 [RISK] Initializing RiskScores with POLLING...');
    console.log('🔧 [RISK] Event ID:', riskScoreEventId);

    // Use HTTP client for polling (more reliable)
    const client = createPublicClient({
      chain: somniaTestnet,
      transport: http('https://dream-rpc.somnia.network')
    });

    const sdk = new SDK({ public: client as any });
    const schemaEncoder = new SchemaEncoder(riskScoreSchema);

    // Track seen risk scores to avoid duplicates
    const seenRiskIds = new Set<string>();
    let pollInterval: NodeJS.Timeout;

    const pollForRiskScores = async () => {
      try {
        // Compute schema ID
        const schemaId = await sdk.streams.computeSchemaId(riskScoreSchema);
        if (schemaId instanceof Error) {
          console.error('❌ [RISK] Failed to compute schema ID:', schemaId.message);
          return;
        }

        // Publisher address from backend
        const publisher = '0xe21c64a04562D53EA6AfFeB1c1561e49397B42dd' as `0x${string}`;

        console.log('🔄 [RISK] Polling for risk scores...');

        // Get all data for this publisher and schema
        const data = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher);

        if (data instanceof Error) {
          // NoData error is expected when no risk scores exist yet
          if (data.message.includes('NoData')) {
            console.log('📭 [RISK] No risk scores published yet');
          } else {
            console.error('❌ [RISK] Polling error:', data.message);
          }
          return;
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
          console.log('📭 [RISK] No risk scores found');
          return;
        }

        console.log(`✅ [RISK] Found ${Array.isArray(data) ? data.length : 1} risk score(s)`);

        // Process risk scores
        const scoresArray = Array.isArray(data) ? data : [data];
        let newScores = 0;

        for (const item of scoresArray) {
          try {
            // Decode the data
            let decoded;
            if (typeof item === 'string') {
              decoded = schemaEncoder.decodeData(item as `0x${string}`);
            } else if (Array.isArray(item)) {
              decoded = item;
            } else {
              console.warn('⚠️ [RISK] Unknown data format:', typeof item);
              continue;
            }

            // Extract risk score data - handle both decoded objects and raw values
            const dataObj: any = {};
            for (const field of decoded) {
              // If field has name/value structure, extract value; otherwise use as-is
              if (field && typeof field === 'object' && 'name' in field && 'value' in field) {
                dataObj[field.name] = field.value;
              } else if (field && typeof field === 'object' && 'name' in field) {
                dataObj[field.name] = field;
              }
            }

            // Ensure all values are primitive types (strings, numbers, etc.)
            const getValue = (val: any): any => {
              if (val && typeof val === 'object' && 'value' in val) {
                return val.value;
              }
              return val;
            };

            // Create unique ID from contract + sender + txHash
            const contractAddress = String(getValue(dataObj.contractAddress));
            const sender = String(getValue(dataObj.sender));
            const txHash = String(getValue(dataObj.txHash));
            const uniqueId = `${contractAddress}_${sender}_${txHash}`;

            if (!seenRiskIds.has(uniqueId)) {
              seenRiskIds.add(uniqueId);
              newScores++;

              const riskScore: RiskScore = {
                timestamp: Number(getValue(dataObj.timestamp)),
                contractAddress: contractAddress,
                sender: sender,
                txHash: txHash,
                riskScore: Number(getValue(dataObj.riskScore)),
                riskLevel: String(getValue(dataObj.riskLevel)),
                primaryFactor: String(getValue(dataObj.primaryFactor)),
                value: String(getValue(dataObj.value) ?? '0'),
                gasUsed: String(getValue(dataObj.gasUsed) ?? '0')
              };

              console.log('🎉 [RISK] New risk score detected:', riskScore.riskLevel, `(${riskScore.riskScore})`);
              setRiskScores(prev => [riskScore, ...prev]);
            }
          } catch (error) {
            console.error('❌ [RISK] Error processing risk score:', error);
          }
        }

        if (newScores > 0) {
          console.log(`✨ [RISK] Added ${newScores} new risk score(s)`);
        } else {
          console.log('📌 [RISK] No new risk scores (all previously seen)');
        }

        setIsConnected(true);
        setError(null);

      } catch (error) {
        console.error('❌ [RISK] Polling error:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Initial poll
    pollForRiskScores();

    // Poll every 10 seconds
    pollInterval = setInterval(pollForRiskScores, 10000);

    console.log('✅ [RISK] Polling started (every 10 seconds)');

    /*
     * =========================================================================
     * SUBSCRIPTION CODE - Currently commented out as subscriptions don't work
     * =========================================================================
     *
     * Root cause: Backend was publishing with invalid event topics (addresses
     * need to be padded to bytes32). Even after fixing this, the somnia_watch
     * RPC subscription method doesn't trigger onData callbacks.
     *
     * Keeping this code for future reference when SDS subscriptions are fixed.
     *
     * To re-enable: Uncomment the initSubscription() call below
     * =========================================================================
     *
    const initSubscription = async () => {
      try {
        const wsClient = createPublicClient({
          chain: somniaTestnet,
          transport: webSocket('wss://dream-rpc.somnia.network/ws')
        });

        const wsSDK = new SDK({ public: wsClient as any });
        const schemaId = await wsSDK.streams.computeSchemaId(riskScoreSchema);
        if (schemaId instanceof Error) throw schemaId;

        console.log('🔧 [RISK-SUB] Attempting subscription (experimental)...');

        await wsSDK.streams.subscribe({
          somniaStreamsEventId: riskScoreEventId,
          ethCalls: [],
          onlyPushChanges: false,
          onData: async (data: any) => {
            console.log('✅✅✅ [RISK-SUB] EVENT RECEIVED VIA SUBSCRIPTION ✅✅✅');
            console.log('📥 [RISK-SUB] Raw event data:', JSON.stringify(data, null, 2));

            try {
              const eventData = data.result.data;
              const topics = data.result.topics;

              const [dataId] = decodeAbiParameters(
                parseAbiParameters('bytes32 dataId'),
                eventData
              );

              const publisher = getAddress('0x' + topics[2].slice(26));
              const streamData = await wsSDK.streams.getByKey(schemaId, publisher, dataId);

              if (streamData instanceof Error) {
                console.error('❌ [RISK-SUB] getByKey error:', streamData);
                return;
              }

              // Process streamData similar to polling logic above
              // ... (same decoding logic)

            } catch (error) {
              console.error('❌ [RISK-SUB] Error processing event:', error);
            }
          },
          onError: (error: any) => {
            console.error('❌ [RISK-SUB] Subscription error:', error);
          }
        });

        console.log('✅ [RISK-SUB] Subscription established (as backup to polling)');
      } catch (error) {
        console.error('❌ [RISK-SUB] Subscription failed:', error);
      }
    };

    // Uncomment to enable subscription as backup:
    // initSubscription();
    */

    return () => {
      console.log('🔌 [RISK] Cleaning up polling...');
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  return { riskScores, isConnected, error };
}
