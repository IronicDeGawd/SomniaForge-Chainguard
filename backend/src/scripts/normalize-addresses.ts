/**
 * Database Migration Script: Normalize all Ethereum addresses to lowercase
 *
 * This script updates all existing addresses in the database to be lowercase
 * for consistency and to prevent duplicate entries with different casing.
 *
 * Run with: tsx src/scripts/normalize-addresses.ts
 */

import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';

async function normalizeAllAddresses() {
  logger.info('Starting address normalization migration...');

  try {
    // Normalize users table
    const users = await prisma.user.findMany();
    logger.info(`Found ${users.length} users to normalize`);

    for (const user of users) {
      const normalizedAddress = user.address.toLowerCase();
      if (user.address !== normalizedAddress) {
        await prisma.user.update({
          where: { id: user.id },
          data: { address: normalizedAddress }
        });
        logger.info(`✓ Normalized user address: ${user.address} → ${normalizedAddress}`);
      }
    }

    // Normalize contracts table
    const contracts = await prisma.contract.findMany();
    logger.info(`Found ${contracts.length} contracts to normalize`);

    for (const contract of contracts) {
      const normalizedAddress = contract.address.toLowerCase();
      if (contract.address !== normalizedAddress) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { address: normalizedAddress }
        });
        logger.info(`✓ Normalized contract address: ${contract.address} → ${normalizedAddress}`);
      }
    }

    // Normalize alerts table
    const alerts = await prisma.alert.findMany();
    logger.info(`Found ${alerts.length} alerts to normalize`);

    for (const alert of alerts) {
      const normalizedAddress = alert.contractAddress.toLowerCase();
      if (alert.contractAddress !== normalizedAddress) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { contractAddress: normalizedAddress }
        });
        logger.info(`✓ Normalized alert contract address: ${alert.contractAddress} → ${normalizedAddress}`);
      }
    }

    // Normalize findings table
    const findings = await prisma.finding.findMany();
    logger.info(`Found ${findings.length} findings to normalize`);

    for (const finding of findings) {
      const normalizedAddress = finding.contractAddress.toLowerCase();
      if (finding.contractAddress !== normalizedAddress) {
        await prisma.finding.update({
          where: { id: finding.id },
          data: { contractAddress: normalizedAddress }
        });
        logger.info(`✓ Normalized finding contract address: ${finding.contractAddress} → ${normalizedAddress}`);
      }
    }

    // Normalize transactions table
    const transactions = await prisma.transaction.findMany({
      where: {
        contractAddress: { not: null }
      }
    });
    logger.info(`Found ${transactions.length} transactions to normalize`);

    for (const tx of transactions) {
      if (tx.contractAddress) {
        const normalizedAddress = tx.contractAddress.toLowerCase();
        if (tx.contractAddress !== normalizedAddress) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { contractAddress: normalizedAddress }
          });
          logger.info(`✓ Normalized transaction contract address: ${tx.contractAddress} → ${normalizedAddress}`);
        }
      }
    }

    logger.info('✅ Address normalization migration completed successfully!');
  } catch (error) {
    logger.error('❌ Error during address normalization:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
normalizeAllAddresses()
  .then(() => {
    logger.info('Migration finished. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
