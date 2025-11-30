import { Router } from 'express';
import { verifyMessage } from 'viem';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma.js';
import { env } from '../config/env.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = Router();

// CRITICAL: JWT_SECRET must be set (validated in middleware/auth.ts)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. ' +
    'Please set JWT_SECRET in your .env file.'
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { address, signature, timestamp } = req.body;

    if (!address || !signature || !timestamp) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // Verify timestamp (allow 5 min window for initial login)
    const now = Date.now();
    const ts = parseInt(timestamp);
    if (Math.abs(now - ts) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Login timestamp expired' });
    }

    const message = `Login to ChainGuard: ${timestamp}`;

    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { address: address.toLowerCase() }
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, address: user.address },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json(serializeBigInt({ token, user }));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
