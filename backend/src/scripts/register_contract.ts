
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { somniaTestnet } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config({ path: '../test-environment/.env' });

const API_URL = 'http://localhost:3000/api';

async function main() {
  const privateKey = process.env.PRIVATE_KEY_1;
  if (!privateKey) throw new Error('PRIVATE_KEY_1 not found');

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`Using account: ${account.address}`);

  // 1. Login
  const timestamp = Date.now();
  const message = `Login to ChainGuard: ${timestamp}`;
  const signature = await account.signMessage({ message });

  console.log('Logging in...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      signature,
      timestamp
    })
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status} ${text}`);
  }

  const { token } = await loginRes.json() as any;
  console.log('Login successful, got token.');

  // 2. Register Contract
  const contractAddress = process.env.GENERAL_TEST_ADDRESS;
  if (!contractAddress) throw new Error('GENERAL_TEST_ADDRESS not found');

  console.log(`Registering contract ${contractAddress}...`);
  const regRes = await fetch(`${API_URL}/contracts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      address: contractAddress,
      name: 'GeneralTest',
      network: 'testnet'
    })
  });

  if (!regRes.ok) {
    const text = await regRes.text();
    if (regRes.status === 409) {
        console.log('Contract already registered.');
        return;
    }
    throw new Error(`Registration failed: ${regRes.status} ${text}`);
  }

  const contract = await regRes.json();
  console.log('✅ Contract registered successfully:', contract);
}

main().catch(console.error);
