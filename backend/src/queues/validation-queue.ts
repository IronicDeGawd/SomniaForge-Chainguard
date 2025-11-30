/**
 * LLM Validation Queue
 *
 * Implements rate limiting, cost tracking, and priority queuing for LLM validations
 * Uses in-memory queue for simplicity (can be upgraded to Bull/Redis for production scaling)
 */

import { validateFinding } from '../llm/validator.js';
import { logger } from '../utils/logger.js';

interface QueuedValidation {
  id: string;
  finding: any;
  priority: 'high' | 'medium' | 'low';
  addedAt: number;
  attempts: number;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  totalCost: number;
  budgetRemaining: number;
  rateLimit: {
    count: number;
    max: number;
    windowRemainingMs: number;
  };
}

class ValidationQueue {
  private queue: QueuedValidation[] = [];
  private activeJobs = 0;
  private completedCount = 0;
  private failedCount = 0;
  private isPaused = false;

  // Rate limiting: Max 10 validations per minute
  private validationCount = 0;
  private windowStart = Date.now();
  private readonly MAX_VALIDATIONS_PER_MINUTE = 10;
  private readonly WINDOW_MS = 60 * 1000;

  // Cost tracking
  private totalCost = 0;
  private readonly COST_PER_VALIDATION = 0.01;  // $0.01 per validation (adjust based on actual costs)
  private readonly MAX_DAILY_BUDGET = 10.00;    // $10/day max

  // Concurrency control
  private readonly MAX_CONCURRENT = 1;

  // Priority map for sorting
  private readonly priorityMap = { high: 1, medium: 2, low: 3 };

  constructor() {
    // Reset daily cost at midnight
    this.scheduleDailyMidnightReset();

    // Start processing queue
    this.processQueue();
  }

  /**
   * Add a finding to the validation queue
   */
  async queueValidation(
    finding: any,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    // Check if already queued (prevent duplicates)
    if (this.queue.some(item => item.id === finding.id)) {
      logger.warn(`Finding ${finding.id} already queued, skipping`);
      return;
    }

    const queueItem: QueuedValidation = {
      id: finding.id,
      finding,
      priority,
      addedAt: Date.now(),
      attempts: 0
    };

    this.queue.push(queueItem);

    // Sort queue by priority
    this.queue.sort((a, b) => {
      const priorityDiff = this.priorityMap[a.priority] - this.priorityMap[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // Same priority: FIFO
      return a.addedAt - b.addedAt;
    });

    logger.info(`Finding ${finding.id} queued for validation (priority: ${priority}, queue size: ${this.queue.length})`);
  }

  /**
   * Process queue continuously
   */
  private async processQueue(): Promise<void> {
    while (true) {
      // Wait if paused
      if (this.isPaused) {
        await this.sleep(1000);
        continue;
      }

      // Wait if no items in queue
      if (this.queue.length === 0) {
        await this.sleep(500);
        continue;
      }

      // Wait if max concurrent jobs reached
      if (this.activeJobs >= this.MAX_CONCURRENT) {
        await this.sleep(100);
        continue;
      }

      // Check rate limit
      const now = Date.now();
      if (now - this.windowStart > this.WINDOW_MS) {
        // Reset window
        this.validationCount = 0;
        this.windowStart = now;
      }

      if (this.validationCount >= this.MAX_VALIDATIONS_PER_MINUTE) {
        const waitTime = this.WINDOW_MS - (now - this.windowStart);
        logger.warn(`Rate limit reached (${this.validationCount}/${this.MAX_VALIDATIONS_PER_MINUTE}), waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        continue;
      }

      // Check budget
      if (this.totalCost >= this.MAX_DAILY_BUDGET) {
        if (!this.isPaused) {
          logger.error(`Daily budget exceeded ($${this.totalCost.toFixed(2)}/$${this.MAX_DAILY_BUDGET}), pausing validations`);
          this.pause();
        }
        await this.sleep(60000); // Check every minute
        continue;
      }

      // Get next job
      const job = this.queue.shift();
      if (!job) continue;

      // Process job (don't await - run concurrently)
      this.processJob(job).catch(err => {
        logger.error(`Error processing job ${job.id}:`, err);
      });

      // Small delay between starting jobs
      await this.sleep(50);
    }
  }

  /**
   * Process a single validation job
   */
  private async processJob(job: QueuedValidation): Promise<void> {
    this.activeJobs++;
    job.attempts++;

    try {
      logger.info(`Processing validation for finding ${job.id} (attempt ${job.attempts})`);

      // Perform validation
      const result = await validateFinding(job.finding);

      // Track cost and rate
      this.validationCount++;
      this.totalCost += this.COST_PER_VALIDATION;
      this.completedCount++;

      logger.info(
        `✅ Validation completed for ${job.id}. ` +
        `Cost: $${this.totalCost.toFixed(2)}/$${this.MAX_DAILY_BUDGET} | ` +
        `Rate: ${this.validationCount}/${this.MAX_VALIDATIONS_PER_MINUTE}`
      );

    } catch (error: any) {
      logger.error(`❌ Validation failed for ${job.id}:`, error);

      // Retry logic
      if (job.attempts < 3) {
        logger.info(`Retrying ${job.id} (attempt ${job.attempts + 1}/3)`);
        // Re-queue with exponential backoff
        await this.sleep(1000 * Math.pow(2, job.attempts));
        this.queue.unshift(job);  // Add to front with current priority
      } else {
        this.failedCount++;
        logger.error(`Max retries reached for ${job.id}, giving up`);
      }
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Pause validation queue
   */
  pause(): void {
    this.isPaused = true;
    logger.warn('⏸️  LLM validations paused');
  }

  /**
   * Resume validation queue
   */
  resume(): void {
    this.isPaused = false;
    logger.info('▶️  LLM validations resumed');
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const now = Date.now();
    const windowRemaining = this.WINDOW_MS - (now - this.windowStart);

    return {
      waiting: this.queue.length,
      active: this.activeJobs,
      completed: this.completedCount,
      failed: this.failedCount,
      totalCost: this.totalCost,
      budgetRemaining: this.MAX_DAILY_BUDGET - this.totalCost,
      rateLimit: {
        count: this.validationCount,
        max: this.MAX_VALIDATIONS_PER_MINUTE,
        windowRemainingMs: Math.max(0, windowRemaining)
      }
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    logger.info('Queue cleared');
  }

  /**
   * Reset daily cost tracking
   */
  private scheduleDailyMidnightReset(): void {
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.totalCost = 0;
        this.completedCount = 0;
        this.failedCount = 0;
        if (this.isPaused) {
          this.resume();
        }
        logger.info('🔄 Daily budget and stats reset');
      }
    }, 60 * 1000);  // Check every minute
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const validationQueue = new ValidationQueue();

// Export functions for easy access
export async function queueValidation(finding: any, priority: 'high' | 'medium' | 'low' = 'medium') {
  return validationQueue.queueValidation(finding, priority);
}

export function pauseValidations() {
  validationQueue.pause();
}

export function resumeValidations() {
  validationQueue.resume();
}

export function getQueueStats() {
  return validationQueue.getStats();
}

export function clearQueue() {
  validationQueue.clear();
}
