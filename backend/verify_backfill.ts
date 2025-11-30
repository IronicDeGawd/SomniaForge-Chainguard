import prisma from './src/db/prisma.js';

async function checkTransactions() {
  try {
    const count = await prisma.transaction.count();
    console.log(`Total transactions in DB: ${count}`);
    
    const txs = await prisma.transaction.findMany({ take: 5 });
    console.log('Sample transactions:', txs);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();
