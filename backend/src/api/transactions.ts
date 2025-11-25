
import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

// GET /api/transactions - List recent transactions
router.get('/', async (req, res) => {
  try {
    const { limit = '50', contractAddress } = req.query;
    
    const where: any = {};
    if (contractAddress) {
      where.contractAddress = contractAddress;
    }
    
    const transactions = await prisma.transaction.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { timestamp: 'desc' },
      include: {
        contract: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
