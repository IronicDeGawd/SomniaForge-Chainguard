
import { createPublicClient, http, defineChain } from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: {
    default: { 
      http: ['https://dream-rpc.somnia.network'],
    },
    public: { 
      http: ['https://dream-rpc.somnia.network'],
    }
  }
});

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http()
});

async function main() {
  const address = process.argv[2];
  if (!address) {
    console.error('Please provide a contract address');
    process.exit(1);
  }

  console.log(`Checking tx count for ${address}...`);
  
  const nonce = await client.getTransactionCount({
    address: address as `0x${string}`
  });

  console.log(`RPC getTransactionCount (Nonce): ${nonce}`);
  
  // Try to get code to verify it's a contract
  const code = await client.getBytecode({
    address: address as `0x${string}`
  });
  console.log(`Is Contract: ${code && code.length > 2 ? 'Yes' : 'No'}`);
}

main().catch(console.error);
