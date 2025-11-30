import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Starting database cleanup...\n');

  try {
    // Delete in order to respect foreign key constraints
    console.log('Deleting function gas profiles...');
    const gasProfiles = await prisma.functionGasProfile.deleteMany();
    console.log(`  ✅ Deleted ${gasProfiles.count} function gas profiles`);

    console.log('Deleting findings...');
    const findings = await prisma.finding.deleteMany();
    console.log(`  ✅ Deleted ${findings.count} findings`);

    console.log('Deleting alerts...');
    const alerts = await prisma.alert.deleteMany();
    console.log(`  ✅ Deleted ${alerts.count} alerts`);

    console.log('Deleting transactions...');
    const transactions = await prisma.transaction.deleteMany();
    console.log(`  ✅ Deleted ${transactions.count} transactions`);

    console.log('Deleting failed monitors...');
    const failedMonitors = await prisma.failedMonitor.deleteMany();
    console.log(`  ✅ Deleted ${failedMonitors.count} failed monitors`);

    console.log('Deleting contracts...');
    const contracts = await prisma.contract.deleteMany();
    console.log(`  ✅ Deleted ${contracts.count} contracts`);

    console.log('Deleting users...');
    const users = await prisma.user.deleteMany();
    console.log(`  ✅ Deleted ${users.count} users`);

    console.log('\n✨ Database cleanup complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Function Gas Profiles: ${gasProfiles.count}`);
    console.log(`   - Findings: ${findings.count}`);
    console.log(`   - Alerts: ${alerts.count}`);
    console.log(`   - Transactions: ${transactions.count}`);
    console.log(`   - Failed Monitors: ${failedMonitors.count}`);
    console.log(`   - Contracts: ${contracts.count}`);
    console.log(`   - Users: ${users.count}`);
    console.log(`   Total records deleted: ${
      gasProfiles.count +
      findings.count +
      alerts.count +
      transactions.count +
      failedMonitors.count +
      contracts.count +
      users.count
    }\n`);

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup
clearDatabase()
  .then(() => {
    console.log('Done! Database is now empty.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to clear database:', error);
    process.exit(1);
  });
