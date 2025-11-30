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

const securityAlertSchema = `uint64 timestamp, address contractAddress, bytes32 txHash, string alertType, string severity, string description, uint256 value, uint256 gasUsed, uint8 confidence`;
const securityAlertEventId = 'ChainGuardAlert';

export interface SecurityAlert {
  timestamp: number;
  contractAddress: string;
  txHash: string;
  alertType: string;
  severity: string;
  description: string;
  value: string;
  gasUsed: string;
  confidence: number;
}

export function useSecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to dismiss/remove an alert
  const dismissAlert = (txHash: string) => {
    setAlerts(prev => prev.filter(alert => alert.txHash !== txHash));
  };

  useEffect(() => {
    console.log('🔧 [SDS] Initializing SecurityAlerts with POLLING...');
    console.log('🔧 [SDS] Event ID:', securityAlertEventId);

    // Use HTTP client for polling (more reliable)
    const client = createPublicClient({
      chain: somniaTestnet,
      transport: http('https://dream-rpc.somnia.network')
    });

    const sdk = new SDK({ public: client as any });
    const schemaEncoder = new SchemaEncoder(securityAlertSchema);

    // Track seen alerts to avoid duplicates
    const seenAlertIds = new Set<string>();
    let pollInterval: NodeJS.Timeout;

    const pollForAlerts = async () => {
      try {
        // Compute schema ID
        const schemaId = await sdk.streams.computeSchemaId(securityAlertSchema);
        if (schemaId instanceof Error) {
          console.error('❌ [SDS] Failed to compute schema ID:', schemaId.message);
          return;
        }

        // Publisher address from backend
        const publisher = '0xe21c64a04562D53EA6AfFeB1c1561e49397B42dd' as `0x${string}`;

        console.log('🔄 [SDS] Polling for alerts...');

        // Get all data for this publisher and schema
        const data = await sdk.streams.getAllPublisherDataForSchema(schemaId, publisher);

        if (data instanceof Error) {
          // NoData error is expected when no alerts exist yet
          if (data.message.includes('NoData')) {
            console.log('📭 [SDS] No alerts published yet');
          } else {
            console.error('❌ [SDS] Polling error:', data.message);
          }
          return;
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
          console.log('📭 [SDS] No alerts found');
          return;
        }

        console.log(`✅ [SDS] Found ${Array.isArray(data) ? data.length : 1} alert(s)`);

        // Process alerts
        const alertsArray = Array.isArray(data) ? data : [data];
        let newAlerts = 0;

        for (const item of alertsArray) {
          try {
            // Decode the data
            let decoded;
            if (typeof item === 'string') {
              decoded = schemaEncoder.decodeData(item as `0x${string}`);
            } else if (Array.isArray(item)) {
              decoded = item;
            } else {
              console.warn('⚠️ [SDS] Unknown data format:', typeof item);
              continue;
            }

            // Extract alert data - handle both decoded objects and raw values
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

            // Create unique ID from contract + txHash
            const contractAddress = String(getValue(dataObj.contractAddress));
            const txHash = String(getValue(dataObj.txHash));
            const uniqueId = `${contractAddress}_${txHash}`;

            if (!seenAlertIds.has(uniqueId)) {
              seenAlertIds.add(uniqueId);
              newAlerts++;

              const alert: SecurityAlert = {
                timestamp: Number(getValue(dataObj.timestamp)),
                contractAddress: contractAddress,
                txHash: txHash,
                alertType: String(getValue(dataObj.alertType)),
                severity: String(getValue(dataObj.severity)),
                description: String(getValue(dataObj.description)),
                value: String(getValue(dataObj.value) ?? '0'),
                gasUsed: String(getValue(dataObj.gasUsed) ?? '0'),
                confidence: Number(getValue(dataObj.confidence))
              };

              console.log('🎉 [SDS] New alert detected:', alert.alertType);
              setAlerts(prev => [alert, ...prev]);
            }
          } catch (error) {
            console.error('❌ [SDS] Error processing alert:', error);
          }
        }

        if (newAlerts > 0) {
          console.log(`✨ [SDS] Added ${newAlerts} new alert(s)`);
        } else {
          console.log('📌 [SDS] No new alerts (all previously seen)');
        }

        setIsConnected(true);
        setError(null);

      } catch (error) {
        console.error('❌ [SDS] Polling error:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Initial poll
    pollForAlerts();

    // Poll every 10 seconds
    pollInterval = setInterval(pollForAlerts, 10000);

    console.log('✅ [SDS] Polling started (every 10 seconds)');

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
        const schemaId = await wsSDK.streams.computeSchemaId(securityAlertSchema);
        if (schemaId instanceof Error) throw schemaId;

        console.log('🔧 [SDS-SUB] Attempting subscription (experimental)...');

        await wsSDK.streams.subscribe({
          somniaStreamsEventId: securityAlertEventId,
          ethCalls: [],
          onlyPushChanges: false,
          onData: async (data: any) => {
            console.log('✅✅✅ [SDS-SUB] EVENT RECEIVED VIA SUBSCRIPTION ✅✅✅');
            console.log('📥 [SDS-SUB] Raw event data:', JSON.stringify(data, null, 2));

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
                console.error('❌ [SDS-SUB] getByKey error:', streamData);
                return;
              }

              // Process streamData similar to polling logic above
              // ... (same decoding logic)

            } catch (error) {
              console.error('❌ [SDS-SUB] Error processing event:', error);
            }
          },
          onError: (error: any) => {
            console.error('❌ [SDS-SUB] Subscription error:', error);
          }
        });

        console.log('✅ [SDS-SUB] Subscription established (as backup to polling)');
      } catch (error) {
        console.error('❌ [SDS-SUB] Subscription failed:', error);
      }
    };

    // Uncomment to enable subscription as backup:
    // initSubscription();
    */

    return () => {
      console.log('🔌 [SDS] Cleaning up polling...');
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  return { alerts, isConnected, error, dismissAlert };
}
