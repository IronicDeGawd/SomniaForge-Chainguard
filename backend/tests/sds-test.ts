import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load env vars BEFORE importing modules that use them
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Assuming we run from project root, backend/.env is at resolve(process.cwd(), 'backend/.env')
dotenv.config({ path: resolve(process.cwd(), 'backend/.env') });

console.log('DEBUG: SOMNIA_WS_URL =', process.env.SOMNIA_WS_URL);

const DUMMY_ADDRESS = '0x1234567890123456789012345678901234567890';
const DUMMY_NAME = 'SDS Test Contract';

async function runTest() {
  console.log('🧪 Starting SDS Integration Test...');

  // Dynamic imports to ensure env vars are loaded first
  const { sdsMonitor } = await import('../src/services/monitor.js');
  const { default: prisma } = await import('../src/db/prisma.js');

  try {
    // 1. Setup: Create dummy contract in DB
    console.log('📝 Creating dummy contract in database...');
    // Upsert to avoid unique constraint errors if previous test failed
    await prisma.contract.upsert({
      where: { address: DUMMY_ADDRESS },
      update: { name: DUMMY_NAME },
      create: {
        address: DUMMY_ADDRESS,
        name: DUMMY_NAME,
        status: 'pending'
      }
    });
    console.log('✅ Dummy contract created.');

    // 2. Test Start Monitoring
    console.log('📡 Starting SDS monitoring...');
    await sdsMonitor.startMonitoring(DUMMY_ADDRESS);

    // 3. Verify Status
    const status = sdsMonitor.getStatus();
    console.log('📊 Monitor Status:', status);

    if (status.isMonitoring && status.monitoredContracts.includes(DUMMY_ADDRESS)) {
      console.log('✅ Monitoring started successfully.');
    } else {
      console.error('❌ Failed to start monitoring.');
      process.exit(1);
    }

    // 4. Wait to verify connection stability (and check for immediate errors)
    console.log('⏳ Waiting 5 seconds to verify connection stability...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Test Stop Monitoring
    console.log('🛑 Stopping SDS monitoring...');
    await sdsMonitor.stopMonitoring(DUMMY_ADDRESS);

    const finalStatus = sdsMonitor.getStatus();
    console.log('📊 Final Monitor Status:', finalStatus);

    if (!finalStatus.monitoredContracts.includes(DUMMY_ADDRESS)) {
      console.log('✅ Monitoring stopped successfully.');
    } else {
      console.error('❌ Failed to stop monitoring.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    // 6. Cleanup
    console.log('🧹 Cleaning up...');
    try {
      // Need to re-import prisma or use the one we have
      const { default: prismaCleanup } = await import('../src/db/prisma.js');
      await prismaCleanup.contract.delete({ where: { address: DUMMY_ADDRESS } });
      console.log('✅ Dummy contract deleted.');
      await prismaCleanup.$disconnect();
    } catch (e) {
      console.error('⚠️ Cleanup failed:', e);
    }
    
    process.exit(0);
  }
}

runTest();
