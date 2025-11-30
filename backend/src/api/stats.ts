import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/stats - Dashboard statistics
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }


    const [
      totalContracts,
      activeAlerts,
      vulnerabilities24h,
      gasAnomalies
    ] = await Promise.all([
      prisma.contract.count({
        where: { ownerId: userId }
      }),
      prisma.alert.count({ 
        where: { 
          dismissed: false,
          contract: { ownerId: userId }
        } 
      }),
      prisma.alert.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          },
          contract: { ownerId: userId }
        }
      }),
      prisma.alert.count({
        where: {
          OR: [
            { type: 'GAS_ANOMALY' },
            { type: 'SPAM_ATTACK' },
            { 
              type: 'SUSPICIOUS_ACTIVITY',
              description: { contains: 'gas', mode: 'insensitive' }
            }
          ],
          dismissed: false,
          contract: { ownerId: userId }
        }
      })
    ]);
    
    // Get total transactions across user's contracts
    const totalTransactions = await prisma.contract.aggregate({
      where: { ownerId: userId },
      _sum: {
        totalTxs: true
      }
    });

    res.json({
      totalContracts,
      activeAlerts,
      vulnerabilities24h,
      gasAnomalies,
      totalTransactions: totalTransactions._sum.totalTxs || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/stats/network - Network specific statistics
router.get('/network', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [
      totalTransactions,
      flashLoans,
      reentrancyAttempts,
      suspiciousPatterns
    ] = await Promise.all([
      prisma.contract.aggregate({
        where: { ownerId: userId },
        _sum: { totalTxs: true }
      }),
      prisma.alert.count({
        where: { 
          type: 'FLASH_LOAN',
          contract: { ownerId: userId }
        }
      }),
      prisma.alert.count({
        where: { 
          type: 'REENTRANCY',
          contract: { ownerId: userId }
        }
      }),
      prisma.alert.count({
        where: { 
          OR: [
            { severity: 'CRITICAL' },
            { severity: 'HIGH' }
          ],
          contract: { ownerId: userId }
        }
      })
    ]);

    res.json({
      totalTransactions: totalTransactions._sum.totalTxs || 0,
      flashLoans,
      reentrancyAttempts,
      suspiciousPatterns
    });
  } catch (error) {
    console.error('Error fetching network stats:', error);
    res.status(500).json({ error: 'Failed to fetch network statistics' });
  }
});

export default router;
