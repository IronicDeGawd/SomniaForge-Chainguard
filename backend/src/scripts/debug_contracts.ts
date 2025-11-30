
import prisma from '../db/prisma';

async function main() {
  console.log('Checking contracts in database...');
  const contracts = await prisma.contract.findMany();
  console.log(`Found ${contracts.length} contracts:`);
  contracts.forEach(c => {
    console.log(`- ${c.address} (${c.name}): Status=${c.status}, Network=${c.network}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
