
import prisma from '../db/prisma';

async function main() {
  console.log('--- ORPHANED DATA AUDIT ---');

  // 1. Contracts without Owner
  const publicContracts = await prisma.contract.count({
    where: { ownerId: null }
  });
  console.log(`Contracts without Owner: ${publicContracts}`);

  // 2. Alerts linked to Contracts without Owner
  const orphanedAlerts = await prisma.alert.count({
    where: {
      contract: { ownerId: null }
    }
  });
  console.log(`Alerts linked to Public/Orphaned Contracts: ${orphanedAlerts}`);

  // 3. Transactions linked to Contracts without Owner
  const orphanedTxs = await prisma.transaction.count({
    where: {
      contract: { ownerId: null }
    }
  });
  console.log(`Transactions linked to Public/Orphaned Contracts: ${orphanedTxs}`);

  // 4. Alerts without any Contract (should be 0 due to schema)
  // Prisma schema enforces relation, but let's check if any weird state exists
  // Actually schema says `contract Contract @relation(...)` so it's required.
  
  console.log('--- AUDIT COMPLETE ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
