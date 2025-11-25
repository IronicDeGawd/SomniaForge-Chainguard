import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

// GET /api/stats - Dashboard statistics
router.get('/', async (req, res) => {
  try {
    const [
      totalContracts,
      activeAlerts,
      vulnerabilities24h,
      gasAnomalies
    ] = await Promise.all([
      prisma.contract.count(),
      prisma.alert.count({ where: { dismissed: false } }),
      prisma.alert.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.alert.count({
        where: {
          type: 'GAS_ANOMALY',
          dismissed: false
        }
      })
    ]);
    
    res.json({
      totalContracts,
      activeAlerts,
      vulnerabilities24h,
      gasAnomalies
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
