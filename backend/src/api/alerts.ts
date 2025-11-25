import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

// GET /api/alerts - List alerts with filters
router.get('/', async (req, res) => {
  try {
    const { severity, status, contractAddress } = req.query;
    
    const where: any = {};
    
    if (severity && severity !== 'all') {
      where.severity = severity;
    }
    
    if (status === 'active') {
      where.dismissed = false;
    } else if (status === 'dismissed') {
      where.dismissed = true;
    }
    
    if (contractAddress) {
      where.contractAddress = contractAddress;
    }
    
    const alerts = await prisma.alert.findMany({
      where,
      include: {
        contract: {
          select: {
            name: true,
            address: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts/:id/resolve - Mark alert as resolved
router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.alert.update({
      where: { id },
      data: { dismissed: true }
    });
    
    res.json(alert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// GET /api/alerts/:id - Get alert details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        contract: true
      }
    });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert details' });
  }
});

export default router;
