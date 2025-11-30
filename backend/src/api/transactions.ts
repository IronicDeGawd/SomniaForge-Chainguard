
import { Router } from 'express';
import prisma from '../db/prisma.js';
import { serializeBigInt } from '../utils/serialization.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/transactions - List recent transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = '50', contractAddress } = req.query;
    
    const where: any = {
      contract: { ownerId: userId } // Enforce user ownership
    };

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
    
    res.json(serializeBigInt(transactions));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export default router;
