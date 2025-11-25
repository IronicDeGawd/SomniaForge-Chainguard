import { Router } from 'express';
import prisma from '../db/prisma.js';
import { sdsMonitor } from '../services/monitor.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/contracts - List all monitored contracts (Public + User's)
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const where: any = {
      OR: [
        { ownerId: null }, // Public contracts
      ]
    };

    if (userId) {
      where.OR.push({ ownerId: userId }); // User's contracts
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        alerts: {
          where: { dismissed: false },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            findings: true,
            alerts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// POST /api/contracts - Add contract to monitor
router.post('/', authenticate, async (req, res) => {
  try {
    const { address, name, network = 'testnet' } = req.body;
    const userId = req.user?.id;
    
    // Validate address format
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format' });
    }
    
    // Check if contract already exists (globally unique address for now)
    // TODO: Allow same address for different users? For now, keep it unique per network/address
    const existing = await prisma.contract.findUnique({
      where: { address }
    });
    
    if (existing) {
      // If it exists but has no owner, maybe claim it? Or just return error.
      // For now, return error.
      return res.status(409).json({ error: 'Contract already being monitored' });
    }
    
    const contract = await prisma.contract.create({
      data: {
        address,
        name: name || undefined,
        network,
        ownerId: userId // Assign to user if logged in
      }
    });
    
    // Start monitoring this contract on the specific network
    await sdsMonitor.startMonitoring(address, network);
    
    res.status(201).json(contract);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to add contract' });
  }
});

// DELETE /api/contracts/:address - Remove contract
router.delete('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Stop monitoring
    await sdsMonitor.stopMonitoring(address);
    
    await prisma.contract.delete({
      where: { address }
    });
    
    res.json({ success: true, message: 'Contract removed from monitoring' });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ error: 'Failed to remove contract' });
  }
});

// GET /api/contracts/:address - Get contract details
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const contract = await prisma.contract.findUnique({
      where: { address },
      include: {
        alerts: {
          orderBy: { createdAt: 'desc' }
        },
        findings: {
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            transactions: true,
            alerts: true,
            findings: true
          }
        }
      }
    });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract details' });
  }
});

export default router;
