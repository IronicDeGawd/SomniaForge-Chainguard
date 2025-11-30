
import prisma from '../db/prisma';

async function main() {
  const address = '0xff397f3731eacd0739eae0e90e1cac37954b5c62'; // GeneralTest

  console.log('--- DIAGNOSTIC START ---');
  
  // 1. Check Contract Owner
  const contract = await prisma.contract.findUnique({
    where: { address },
    include: { owner: true }
  });
  
  if (!contract) {
    console.log('❌ Contract NOT FOUND in DB');
    return;
  }
  
  console.log(`Contract: ${contract.address}`);
  console.log(`Owner ID: ${contract.ownerId}`);
  console.log(`Owner Address: ${contract.owner?.address}`);
  
  // 2. List all users (to see if there are duplicates)
  const users = await prisma.user.findMany();
  console.log('\n--- ALL USERS ---');
  users.forEach(u => {
    console.log(`User ID: ${u.id} | Address: ${u.address}`);
    if (u.id === contract.ownerId) {
      console.log('  ^-- THIS IS THE OWNER');
    }
  });
  
  // 3. Check Transactions for this contract
  const txCount = await prisma.transaction.count({
    where: { contractAddress: address }
  });
  console.log(`\nTransactions linked to contract: ${txCount}`);
  
  console.log('--- DIAGNOSTIC END ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
