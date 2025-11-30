
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';
import { env } from '../config/env';

// Mock the secret from .env
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-min-32-chars-CHANGE-ME';

async function main() {
  console.log('--- AUTH DEBUG START ---');
  console.log(`Using JWT_SECRET: ${JWT_SECRET.slice(0, 5)}...`);

  const address = '0x1e6c340dd498afc785ba5d88ee2b2115bdcfa745'.toLowerCase();

  // 1. Simulate Login
  console.log(`\n1. Simulating Login for ${address}...`);
  let user = await prisma.user.findUnique({
    where: { address }
  });

  if (!user) {
    console.log('User not found, creating...');
    user = await prisma.user.create({ data: { address } });
  }
  console.log(`User ID: ${user.id}`);

  // 2. Generate Token
  console.log('\n2. Generating Token...');
  const token = jwt.sign(
    { id: user.id, address: user.address },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  console.log(`Token generated: ${token.slice(0, 20)}...`);

  // 3. Verify Token (Middleware Logic)
  console.log('\n3. Verifying Token...');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('✅ Token Verified!');
    console.log('Decoded Payload:', decoded);
    
    if (decoded.id === user.id && decoded.address === address) {
        console.log('✅ Payload matches User');
    } else {
        console.log('❌ Payload MISMATCH');
    }
  } catch (err) {
    console.error('❌ Token Verification FAILED:', err);
  }

  // 4. Check DB for this user's contracts
  const contracts = await prisma.contract.findMany({
      where: { ownerId: user.id }
  });
  console.log(`\n4. User has ${contracts.length} contracts.`);

  console.log('--- AUTH DEBUG END ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
