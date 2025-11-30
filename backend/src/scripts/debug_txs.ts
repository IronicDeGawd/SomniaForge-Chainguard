
import prisma from '../db/prisma';

async function main() {
  const address = '0xff397f3731eacd0739eae0e90e1cac37954b5c62'; // GeneralTest

  console.log(`Checking contract ${address}...`);
  const contract = await prisma.contract.findUnique({
    where: { address },
    include: { owner: true }
  });
  console.log('Contract:', contract ? 'Found' : 'MISSING');
  if (contract) {
    console.log(`- Owner: ${contract.ownerId}`);
    console.log(`- Total Txs (DB count): ${contract.totalTxs}`);
  }

  console.log('\nChecking transactions...');
  // Check for transactions linked to this contract
  const linkedTxs = await prisma.transaction.count({
    where: { contractAddress: address }
  });
  console.log(`- Linked Transactions: ${linkedTxs}`);

  // Check for orphaned transactions (that should belong to this contract)
  // We'll check a few known hashes if possible, or just count nulls
  const orphanedTxs = await prisma.transaction.count({
    where: { 
      contractAddress: null,
      to: address 
    }
  });
  console.log(`- Orphaned Transactions (contractAddress=null, to=address): ${orphanedTxs}`);

  if (orphanedTxs > 0) {
    console.log('⚠️  FOUND ORPHANED TRANSACTIONS! This confirms the bug.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
