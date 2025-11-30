import { Router } from 'express';
import prisma from '../db/prisma.js';
import { serializeBigInt } from '../utils/serialization.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/alerts - List alerts with filters and pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      severity,
      status,
      contractAddress,
      page = '1',
      limit = '50',
      cursor  // For cursor-based pagination
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));  // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      contract: { ownerId: userId } // Enforce user ownership
    };

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

    // Cursor-based pagination (better for real-time data)
    if (cursor) {
      where.id = { gt: cursor };
    }

    // Get total count for pagination metadata
    const total = await prisma.alert.count({ where });

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
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      skip: cursor ? 0 : skip  // Don't skip with cursor-based pagination
    });

    res.json(serializeBigInt({
      data: alerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + alerts.length < total,
        cursor: alerts.length > 0 ? alerts[alerts.length - 1].id : null
      }
    }));
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts/:id/resolve - Mark alert as resolved
router.post('/:id/resolve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verify ownership before updating
    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { contract: true }
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.contract.ownerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You do not own this alert' });
    }

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: { dismissed: true }
    });
    
    res.json(serializeBigInt(updatedAlert));
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// GET /api/alerts/:id - Get alert details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        contract: true
      }
    });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (alert.contract.ownerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You do not own this alert' });
    }
    
    res.json(serializeBigInt(alert));
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert details' });
  }
});

import { validateFinding } from '../llm/validator.js';

// POST /api/alerts/validate/:findingId - Manually validate a finding
router.post('/validate/:findingId', async (req, res) => {
  try {
    const { findingId } = req.params;
    
    const finding = await prisma.finding.findUnique({
      where: { id: findingId }
    });
    
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }
    
    // Convert Prisma finding to Rule Engine finding format
    const engineFinding = {
      type: finding.type,
      severity: finding.severity,
      contractAddress: finding.contractAddress,
      functionName: finding.functionName || undefined,
      line: finding.line || undefined,
      codeSnippet: finding.codeSnippet || undefined,
      ruleConfidence: finding.ruleConfidence,
      description: `Manual validation for finding ${finding.id}`
    };
    
    const result = await validateFinding(engineFinding);
    
    res.json(result);
  } catch (error) {
    console.error('Error validating finding:', error);
    res.status(500).json({ error: 'Failed to validate finding' });
  }
});

export default router;
