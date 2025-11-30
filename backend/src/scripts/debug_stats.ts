
import prisma from '../db/prisma';
import { serializeBigInt } from '../utils/serialization';

async function main() {
  const ownerId = 'ccb6f977-a9dd-40eb-9364-1cbd5e302db7'; // The correct owner

  console.log(`Simulating /api/stats for user ${ownerId}...`);

  // Logic from stats.ts
  const contracts = await prisma.contract.findMany({
    where: { ownerId },
    select: { id: true, address: true }
  });
  const contractIds = contracts.map(c => c.id);
  const contractAddresses = contracts.map(c => c.address);

  console.log(`User owns ${contracts.length} contracts:`, contractAddresses);

  const totalTransactions = await prisma.transaction.count({
    where: {
      contract: { ownerId }
    }
  });

  console.log(`Total Transactions (via Prisma count): ${totalTransactions}`);
  
  // Check if the query in stats.ts matches this
  /*
    const totalTransactions = await prisma.transaction.count({
      where: {
        contract: { ownerId: userId }
      }
    });
  */
  
  if (totalTransactions === 0) {
    console.log('⚠️  API would return 0. Why?');
    // Debug: check a single transaction
    const tx = await prisma.transaction.findFirst({
      where: { contractAddress: '0xff397f3731eacd0739eae0e90e1cac37954b5c62' },
      include: { contract: true }
    });
    console.log('Sample Transaction:', tx);
    if (tx) {
        console.log('Tx Contract Owner:', tx.contract?.ownerId);
        console.log('Match?', tx.contract?.ownerId === ownerId);
    }
  } else {
    console.log('✅ API should return correct count.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
