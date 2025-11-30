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

  useEffect(() => {
    const client = createPublicClient({
      chain: somniaTestnet,
      transport: webSocket('wss://dream-rpc.somnia.network/ws')
    });

    const sdk = new SDK({ public: client as any });
    const schemaEncoder = new SchemaEncoder(securityAlertSchema);

    const initSubscription = async () => {
      try {
        // Compute schema ID for decoding
        const schemaId = await sdk.streams.computeSchemaId(securityAlertSchema);
        if (schemaId instanceof Error) throw schemaId;

        console.log('Subscribing to SDS events with ID:', securityAlertEventId);

        await sdk.streams.subscribe({
          somniaStreamsEventId: securityAlertEventId,
          ethCalls: [],
          onlyPushChanges: false,
          onData: async (data: any) => {
            console.log('Received SDS event:', data);
            try {
              // Extract dataId from event data
              const eventData = data.result.data;
              const decodedEvent = decodeAbiParameters(
                parseAbiParameters('bytes32 dataId'),
                eventData
              );
              const dataId = decodedEvent[0];

              // Extract publisher from topics (Topic 2)
              // Topic 0: Event Sig, Topic 1: contractAddress, Topic 2: publisher
              const topics = data.result.topics;
              if (!topics || topics.length < 3) {
                console.warn('Received event with insufficient topics');
                return;
              }
              const publisher = getAddress('0x' + topics[2].slice(26));

              console.log(`Fetching alert data for ID ${dataId} from publisher ${publisher}`);

              // Fetch the data stream
              const streamData = await sdk.streams.getByKey(schemaId, publisher, dataId);
              
              if (streamData instanceof Error) {
                console.error('Error fetching stream data:', streamData);
                return;
              }

              // streamData is Hex[] | SchemaDecodedItem[][]
              // For getByKey, it returns the data items.
              // We expect one item usually? Or a list?
              // The return type is Hex[] (raw) or SchemaDecodedItem[][] (decoded).
              // Since we passed schemaId (and it's public), it should be decoded?
              // Actually, getByKey returns `Hex[] | SchemaDecodedItem[][]`.
              // If it's decoded, it's `SchemaDecodedItem[][]`.
              // Each item in the outer array is a row?
              
              if (Array.isArray(streamData) && streamData.length > 0) {
                // Assuming the first item is our data
                const item = streamData[0];
                
                // If it's already decoded (SchemaDecodedItem[])
                if (Array.isArray(item) && typeof item[0] === 'object' && 'name' in item[0]) {
                   const decodedItem = item as any[]; // SchemaDecodedItem[]
                   
                   const alert: SecurityAlert = {
                     timestamp: Number(decodedItem.find((p: any) => p.name === 'timestamp')?.value ?? 0),
                     contractAddress: decodedItem.find((p: any) => p.name === 'contractAddress')?.value as string,
                     txHash: decodedItem.find((p: any) => p.name === 'txHash')?.value as string,
                     alertType: decodedItem.find((p: any) => p.name === 'alertType')?.value as string,
                     severity: decodedItem.find((p: any) => p.name === 'severity')?.value as string,
                     description: decodedItem.find((p: any) => p.name === 'description')?.value as string,
                     value: decodedItem.find((p: any) => p.name === 'value')?.value?.toString() ?? '0',
                     gasUsed: decodedItem.find((p: any) => p.name === 'gasUsed')?.value?.toString() ?? '0',
                     confidence: Number(decodedItem.find((p: any) => p.name === 'confidence')?.value ?? 0)
                   };

                   setAlerts(prev => [alert, ...prev]);
                }
              }
            } catch (e) {
              console.error('Error processing alert:', e);
            }
          }
        });
        setIsConnected(true);
      } catch (err) {
        console.error('Failed to subscribe to alerts:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    initSubscription();
  }, []);

  return { alerts, isConnected, error };
}
