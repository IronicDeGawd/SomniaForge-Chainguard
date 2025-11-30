
import prisma from '../db/prisma';

async function main() {
  const userId = 'ccb6f977-a9dd-40eb-9364-1cbd5e302db7'; // From user logs
  console.log('Debugging stats for user:', userId);

  // 1. Check User
  const user = await prisma.user.findUnique({ where: { id: userId } });
  console.log('User found:', !!user);

  // 2. Check Contracts
  const contracts = await prisma.contract.findMany({ where: { ownerId: userId } });
  console.log('Contracts count:', contracts.length);
  contracts.forEach(c => console.log(` - ${c.address} (owner: ${c.ownerId})`));

  // 3. Check Alerts directly
  const alerts = await prisma.alert.findMany({ take: 5 });
  console.log('Total alerts in DB (sample 5):', alerts.length);
  alerts.forEach(a => console.log(` - Alert ${a.id} for ${a.contractAddress} (dismissed: ${a.dismissed})`));

  // 4. Check Relation Query (The one failing)
  const activeAlertsCount = await prisma.alert.count({
    where: {
      dismissed: false,
      contract: { ownerId: userId }
    }
  });
  console.log('Active Alerts Count (via relation):', activeAlertsCount);

  // 5. Debug Relation
  // Find an alert that SHOULD match
  const targetAlert = alerts.find(a => 
    contracts.some(c => c.address === a.contractAddress) && !a.dismissed
  );

  if (targetAlert) {
    console.log('\nTesting specific alert:', targetAlert.id);
    console.log('Alert Address:', targetAlert.contractAddress);
    
    const linkedContract = await prisma.contract.findUnique({
      where: { address: targetAlert.contractAddress }
    });
    console.log('Linked Contract:', linkedContract?.address);
    console.log('Linked Contract Owner:', linkedContract?.ownerId);
    console.log('Match?', linkedContract?.ownerId === userId);
  } else {
      console.log('No matching alert found in sample to debug relation.');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
