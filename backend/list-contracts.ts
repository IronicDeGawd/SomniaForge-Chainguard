
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany();
  console.log('Monitored Contracts:');
  contracts.forEach(c => {
    console.log(`${c.name || 'Unnamed'}: ${c.address} (${c.network})`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
