/**
 * Baseline Calculator Background Job
 *
 * Calculates 7-day rolling baselines for adaptive anomaly detection
 * Runs every 6 hours to update contract and function-level metrics
 */

import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate contract-level baselines (avgGas, txFrequency, value stats)
 */
export async function updateContractBaselines() {
  logger.info('🔄 Starting contract baseline calculation...');

  try {
    const contracts = await prisma.contract.findMany({
      select: { address: true, network: true }
    });

    logger.info(`Found ${contracts.length} contracts to update`);

    let updated = 0;
    let skipped = 0;

    for (const contract of contracts) {
      try {
        // Get last 7 days of successful transactions
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const transactions = await prisma.transaction.findMany({
          where: {
            contractAddress: contract.address,
            timestamp: { gte: sevenDaysAgo },
            status: 'success'  // Only successful txs for baseline
          },
          select: {
            gasUsed: true,
            value: true,
            timestamp: true
          }
        });

        if (transactions.length < 10) {
          // Need at least 10 successful transactions for meaningful baseline
          logger.debug(`Skipping ${contract.address}: only ${transactions.length} successful txs in 7 days`);
          skipped++;
          continue;
        }

        // Calculate gas statistics
        const gasValues = transactions.map(tx => tx.gasUsed);
        const avgGas = gasValues.reduce((sum, val) => sum + val, 0) / gasValues.length;
        const gasVariance = gasValues.reduce((sum, val) => sum + Math.pow(val - avgGas, 2), 0) / gasValues.length;
        const gasStdDev = Math.sqrt(gasVariance);

        // Calculate value statistics
        const valuesBigInt = transactions.map(tx => BigInt(tx.value));
        const sumValue = valuesBigInt.reduce((sum, val) => sum + val, BigInt(0));
        const avgValueBigInt = sumValue / BigInt(valuesBigInt.length);

        // Calculate value standard deviation
        const valueVariance = valuesBigInt.reduce((sum, val) => {
          const diff = val - avgValueBigInt;
          return sum + (diff * diff);
        }, BigInt(0)) / BigInt(valuesBigInt.length);
        const valueStdDevBigInt = sqrt(valueVariance);

        // Calculate transaction frequency (txs per day)
        const txFrequency = transactions.length / 7;

        // Update contract baseline
        await prisma.contract.update({
          where: { address: contract.address },
          data: {
            baselineGas: Math.round(avgGas),
            baselineGasStdDev: Math.round(gasStdDev),
            baselineTxFrequency: txFrequency,
            baselineValue: avgValueBigInt.toString(),
            baselineValueStdDev: valueStdDevBigInt.toString(),
            baselineLastUpdated: new Date()
          }
        });

        updated++;

        logger.debug(
          `✅ Updated baseline for ${contract.address}: ` +
          `avgGas=${Math.round(avgGas)}, stdDev=${Math.round(gasStdDev)}, ` +
          `freq=${txFrequency.toFixed(2)}/day, samples=${transactions.length}`
        );
      } catch (error) {
        logger.error(`Error updating baseline for ${contract.address}:`, error);
      }
    }

    logger.info(`✅ Contract baseline calculation complete: ${updated} updated, ${skipped} skipped`);
  } catch (error) {
    logger.error('❌ Error in contract baseline calculation:', error);
  }
}

/**
 * Calculate function-level gas baselines
 */
export async function updateFunctionGasProfiles() {
  logger.info('🔄 Starting function gas profile calculation...');

  try {
    const contracts = await prisma.contract.findMany({
      select: { address: true }
    });

    logger.info(`Analyzing function gas usage for ${contracts.length} contracts`);

    let profilesUpdated = 0;

    for (const contract of contracts) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get transactions with function selectors (first 4 bytes of input)
        const transactions = await prisma.transaction.findMany({
          where: {
            contractAddress: contract.address,
            timestamp: { gte: sevenDaysAgo },
            status: 'success'
          },
          select: {
            gasUsed: true
          }
        });

        if (transactions.length === 0) continue;

        // For now, track overall gas profile (function selector extraction requires input field)
        // TODO: Add 'input' field to Transaction model to extract function selectors

        const gasValues = transactions.map(tx => tx.gasUsed);
        const avgGas = gasValues.reduce((sum, val) => sum + val, 0) / gasValues.length;
        const minGas = Math.min(...gasValues);
        const maxGas = Math.max(...gasValues);
        const gasVariance = gasValues.reduce((sum, val) => sum + Math.pow(val - avgGas, 2), 0) / gasValues.length;
        const gasStdDev = Math.sqrt(gasVariance);

        // Upsert function profile (using '0x00000000' as placeholder until we have function selectors)
        await prisma.functionGasProfile.upsert({
          where: {
            contractAddress_functionSelector: {
              contractAddress: contract.address,
              functionSelector: '0x00000000'  // Placeholder for all functions
            }
          },
          update: {
            avgGas: Math.round(avgGas),
            minGas,
            maxGas,
            stdDevGas: gasStdDev,
            callCount: transactions.length,
            lastUpdated: new Date()
          },
          create: {
            contractAddress: contract.address,
            functionSelector: '0x00000000',
            functionName: 'all',
            avgGas: Math.round(avgGas),
            minGas,
            maxGas,
            stdDevGas: gasStdDev,
            callCount: transactions.length
          }
        });

        profilesUpdated++;

        logger.debug(`Updated gas profile for ${contract.address}: avg=${Math.round(avgGas)}, min=${minGas}, max=${maxGas}`);
      } catch (error) {
        logger.error(`Error updating gas profile for ${contract.address}:`, error);
      }
    }

    logger.info(`✅ Function gas profile calculation complete: ${profilesUpdated} profiles updated`);
  } catch (error) {
    logger.error('❌ Error in function gas profile calculation:', error);
  }
}

/**
 * Run both baseline calculations
 */
export async function runBaselineCalculations() {
  logger.info('🚀 Starting baseline calculation job...');

  const startTime = Date.now();

  await updateContractBaselines();
  await updateFunctionGasProfiles();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`✅ Baseline calculation job complete in ${duration}s`);
}

/**
 * Square root for BigInt (Newton's method)
 */
function sqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  if (value < 2n) {
    return value;
  }

  function newtonIteration(n: bigint, x0: bigint): bigint {
    const x1 = ((n / x0) + x0) >> 1n;
    if (x0 === x1 || x0 === (x1 - 1n)) {
      return x0;
    }
    return newtonIteration(n, x1);
  }

  return newtonIteration(value, 1n);
}

// Schedule job to run every 6 hours
const SIX_HOURS = 6 * 60 * 60 * 1000;

export function startBaselineCalculationScheduler() {
  logger.info('📅 Baseline calculation scheduler started (runs every 6 hours)');

  // Run immediately on startup
  runBaselineCalculations().catch(err => {
    logger.error('Error in initial baseline calculation:', err);
  });

  // Then run every 6 hours
  setInterval(() => {
    runBaselineCalculations().catch(err => {
      logger.error('Error in scheduled baseline calculation:', err);
    });
  }, SIX_HOURS);
}
