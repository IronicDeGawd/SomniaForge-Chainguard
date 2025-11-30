/**
 * Manual SDS Publishing Test Script
 *
 * This script publishes a test security alert to Somnia Data Streams
 * to verify end-to-end event flow from backend to frontend.
 *
 * Usage: cd backend && npx tsx src/scripts/test-sds-publish.ts
 */

import { SDK, SchemaEncoder } from '@somnia-chain/streams';
import { createPublicClient, createWalletClient, webSocket, encodeAbiParameters, parseAbiParameters, toHex, pad } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define Somnia Testnet chain
const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: { decimals: 18, name: 'STT', symbol: 'STT' },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public: { http: ['https://dream-rpc.somnia.network'] }
  }
});

// Schema and Event ID (must match frontend)
const securityAlertSchema = `uint64 timestamp, address contractAddress, bytes32 txHash, string alertType, string severity, string description, uint256 value, uint256 gasUsed, uint8 confidence`;
const securityAlertEventId = 'ChainGuardAlert';

async function testPublish() {
  console.log('\n🧪 ========== SDS PUBLISHING TEST ==========\n');

  // Get private key from environment
  const privateKey = process.env.TESTNET_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error('❌ TESTNET_PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log('🔑 Publisher Address:', account.address);
  console.log('   (This should match: 0xe21c64a04562D53EA6AfFeB1c1561e49397B42dd)\n');

  // Create clients
  const wsUrl = 'wss://dream-rpc.somnia.network/ws';
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: webSocket(wsUrl)
  });

  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: webSocket(wsUrl)
  });

  const sdk = new SDK({
    public: publicClient,
    wallet: walletClient
  });

  // Compute schema ID
  console.log('📋 Computing schema ID...');
  const schemaId = await sdk.streams.computeSchemaId(securityAlertSchema);
  if (schemaId instanceof Error) {
    console.error('❌ Failed to compute schema ID:', schemaId);
    process.exit(1);
  }
  console.log('📋 Schema ID:', schemaId);
  console.log('');

  // Prepare test data
  const schemaEncoder = new SchemaEncoder(securityAlertSchema);
  const testContractAddress = '0x1234567890123456789012345678901234567890' as `0x${string}`;
  const testTxHash = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

  const encodedData = schemaEncoder.encodeData([
    { name: 'timestamp', value: BigInt(Date.now()), type: 'uint64' },
    { name: 'contractAddress', value: testContractAddress, type: 'address' },
    { name: 'txHash', value: testTxHash, type: 'bytes32' },
    { name: 'alertType', value: 'TEST_ALERT', type: 'string' },
    { name: 'severity', value: 'CRITICAL', type: 'string' },
    { name: 'description', value: '🚨 THIS IS A TEST ALERT - You should see this in the frontend! 🚨', type: 'string' },
    { name: 'value', value: BigInt(0), type: 'uint256' },
    { name: 'gasUsed', value: BigInt(0), type: 'uint256' },
    { name: 'confidence', value: 95, type: 'uint8' }
  ]);

  // Generate unique data ID
  const dataId = toHex(randomBytes(32), { size: 32 });

  console.log('📤 Publishing test alert to SDS...');
  console.log('   Event ID:', securityAlertEventId);
  console.log('   Schema ID:', schemaId);
  console.log('   Data ID:', dataId);
  console.log('   Contract:', testContractAddress);
  console.log('   Publisher:', account.address);
  console.log('   Topics: [', testContractAddress, ',', account.address, ']');
  console.log('');

  try {
    const txHash = await sdk.streams.setAndEmitEvents(
      [{ id: dataId as `0x${string}`, schemaId: schemaId as `0x${string}`, data: encodedData }],
      [{
        id: securityAlertEventId,
        argumentTopics: [
          pad(testContractAddress, { size: 32 }),  // Pad address to bytes32
          pad(account.address, { size: 32 })        // Pad address to bytes32
        ],
        data: encodeAbiParameters(
          parseAbiParameters('bytes32 dataId'),
          [dataId as `0x${string}`]
        )
      }]
    );

    if (txHash instanceof Error) {
      console.error('❌ setAndEmitEvents FAILED:', txHash.message);
      console.error('   Full error:', txHash);
      process.exit(1);
    }

    console.log('✅ Test alert published successfully!');
    console.log('📝 Transaction Hash:', txHash);
    console.log('');
    console.log('📍 Frontend should query:');
    console.log(`   getByKey("${schemaId}", "${account.address}", "${dataId}")`);
    console.log('');
    console.log('🔍 NOW CHECK YOUR FRONTEND BROWSER CONSOLE');
    console.log('   Expected logs within 30 seconds:');
    console.log('   1. "✅✅✅ [SDS] EVENT RECEIVED ✅✅✅"');
    console.log('   2. Raw event data showing the test alert');
    console.log('   3. "📡 [SDS] getByKey result: SUCCESS"');
    console.log('   4. Alert should appear in the frontend UI');
    console.log('');
    console.log('⏳ Waiting 30 seconds for event propagation...');

    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('\n✅ Test complete!');
    console.log('');
    console.log('❓ Did you see the test alert in the frontend?');
    console.log('   YES → SDS is working! The issue was elsewhere.');
    console.log('   NO → Check the frontend console logs for errors.');
    console.log('');

  } catch (error) {
    console.error('\n❌ Failed to publish test alert:', error);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   - Check TESTNET_PRIVATE_KEY is correct');
    console.error('   - Verify wallet has STT for gas');
    console.error('   - Check network connectivity to Somnia');
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testPublish().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
