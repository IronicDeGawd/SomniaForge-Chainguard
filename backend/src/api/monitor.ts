import { Router } from 'express';
import { sdsMonitor } from '../services/monitor.js';
import { getQueueStats } from '../queues/validation-queue.js';
import { serializeBigInt } from '../utils/serialization.js';

const router = Router();

// GET /api/monitor/status - Get current monitoring status
router.get('/status', (req, res) => {
  try {
    const status = sdsMonitor.getStatus();
    res.json(serializeBigInt(status));
  } catch (error) {
    console.error('Error fetching monitor status:', error);
    res.status(500).json({ error: 'Failed to fetch monitor status' });
  }
});

// GET /api/monitor/health - Get detailed monitoring health (includes failed monitors)
router.get('/health', async (req, res) => {
  try {
    const health = await sdsMonitor.getMonitoringHealth();
    const queueStats = getQueueStats();

    res.json(serializeBigInt({
      ...health,
      validationQueue: queueStats
    }));
  } catch (error) {
    console.error('Error fetching monitor health:', error);
    res.status(500).json({ error: 'Failed to fetch monitor health' });
  }
});

// POST /api/monitor/pause - Pause/Resume monitoring
router.post('/pause', (req, res) => {
  try {
    const { paused } = req.body;
    const isPaused = sdsMonitor.togglePause(paused);
    res.json(serializeBigInt({ isPaused }));
  } catch (error) {
    console.error('Error toggling monitor pause:', error);
    res.status(500).json({ error: 'Failed to toggle monitor pause' });
  }
});

// GET /api/monitor/events - Get SDS event type statistics for diagnostics
router.get('/events', (req, res) => {
  try {
    const stats = sdsMonitor.getEventStats();
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({ error: 'Failed to fetch event statistics' });
  }
});

export default router;
