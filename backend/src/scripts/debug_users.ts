
import prisma from '../db/prisma';

async function main() {
  console.log('--- USER DEBUG ---');
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users:`);
  users.forEach(u => console.log(` - ID: ${u.id}, Address: ${u.address}`));

  console.log('\n--- CONTRACT DEBUG ---');
  const contracts = await prisma.contract.findMany();
  console.log(`Found ${contracts.length} contracts:`);
  contracts.forEach(c => console.log(` - Address: ${c.address}, Owner: ${c.ownerId}`));

  console.log('\n--- ANALYSIS ---');
  const user1 = 'ccb6f977-a9dd-40eb-9364-1cbd5e302db7';
  const user2 = 'c39c1f17-d1df-40a1-ba59-3cc42922c96c';

  const u1 = users.find(u => u.id === user1);
  const u2 = users.find(u => u.id === user2);

  if (u1) console.log(`User 1 (${user1}): ${u1.address}`);
  else console.log(`User 1 (${user1}) NOT FOUND`);

  if (u2) console.log(`User 2 (${user2}): ${u2.address}`);
  else console.log(`User 2 (${user2}) NOT FOUND`);

  if (u1 && u2 && u1.address.toLowerCase() === u2.address.toLowerCase()) {
      console.log('⚠️ DUPLICATE USERS FOR SAME ADDRESS DETECTED!');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
