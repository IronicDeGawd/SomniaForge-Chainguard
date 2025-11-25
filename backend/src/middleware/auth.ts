
import { Request, Response, NextFunction } from 'express';
import { verifyMessage } from 'viem';
import prisma from '../db/prisma.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        address: string;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const address = req.headers['x-wallet-address'] as string;
    const signature = req.headers['x-auth-signature'] as string;
    const timestamp = req.headers['x-auth-timestamp'] as string;

    if (!address || !signature || !timestamp) {
      // Allow public access for now (optional, or return 401)
      // For this implementation, we'll make it optional but preferred
      return next();
    }

    // Verify timestamp to prevent replay attacks (allow 5 min window)
    const now = Date.now();
    const ts = parseInt(timestamp);
    if (Math.abs(now - ts) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Auth timestamp expired' });
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

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
