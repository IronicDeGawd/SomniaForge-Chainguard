import { Router } from 'express';
import prisma from '../db/prisma.js';
import { sdsMonitor } from '../services/monitor.js';
import { authenticate } from '../middleware/auth.js';
import { normalizeAddress, isValidAddress } from '../utils/address.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = Router();

// GET /api/contracts - List all monitored contracts (Public + User's) with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      page = '1',
      limit = '50',
      network,
      status
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      OR: [
        { ownerId: null }, // Public contracts
      ]
    };

    if (userId) {
      // Handle stale JWTs: if we have an address, look up the FRESH user ID
      if (req.user?.address) {
        const user = await prisma.user.findUnique({
          where: { address: req.user.address }
        });
        if (user) {
          where.OR.push({ ownerId: user.id });
        } else {
          // Fallback to token ID if user not found (unlikely if upserted on creation)
          where.OR.push({ ownerId: userId });
        }
      } else {
        where.OR.push({ ownerId: userId });
      }
    }

    // Optional filters
    if (network) {
      where.network = network;
    }

    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await prisma.contract.count({ where });

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
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      skip
    });

    res.json(serializeBigInt({
      data: contracts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + contracts.length < total
      }
    }));
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

    // Validate and normalize address format
    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format' });
    }

    const normalizedAddress = normalizeAddress(address);

    // Check if contract already exists (globally unique address for now)
    const existing = await prisma.contract.findUnique({
      where: { address: normalizedAddress }
    });

    if (existing) {
      return res.status(409).json({ error: 'Contract already being monitored' });
    }

    // Ensure user exists in DB (handle case where DB was reset but token persists)
    let ownerId = userId;
    if (req.user?.address) {
      const user = await prisma.user.upsert({
        where: { address: req.user.address },
        update: {},
        create: { address: req.user.address }
      });
      ownerId = user.id;
    }

    const contract = await prisma.contract.create({
      data: {
        address: normalizedAddress,
        name: name || undefined,
        network,
        ownerId: ownerId // Assign to user if logged in
      }
    });

    // Start monitoring this contract on the specific network
    await sdsMonitor.startMonitoring(normalizedAddress, network);

    res.status(201).json(serializeBigInt(contract));
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to add contract' });
  }
});

// DELETE /api/contracts/:address - Remove contract (requires authentication)
router.delete('/:address', authenticate, async (req, res) => {
  try {
    const { address } = req.params;
    const userId = req.user?.id;

    // Normalize address
    const normalizedAddress = normalizeAddress(address);

    // Verify contract exists
    const contract = await prisma.contract.findUnique({
      where: { address: normalizedAddress },
      select: { ownerId: true, name: true }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Verify ownership - only the owner can delete their contract
    if (contract.ownerId !== userId) {
      return res.status(403).json({
        error: 'Unauthorized: You do not own this contract',
        message: 'Only the contract owner can remove it from monitoring'
      });
    }

    // Stop monitoring
    await sdsMonitor.stopMonitoring(normalizedAddress);

    // Delete contract
    await prisma.contract.delete({
      where: { address: normalizedAddress }
    });

    console.log(`✅ Contract ${normalizedAddress} deleted by user ${userId}`);
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

    // Normalize address
    const normalizedAddress = normalizeAddress(address);

    const contract = await prisma.contract.findUnique({
      where: { address: normalizedAddress },
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
    
    res.json(serializeBigInt(contract));
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract details' });
  }
});

export default router;
