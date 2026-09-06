import { Router, Request, Response } from 'express';
import { emailQueue } from '../queues/emailQueue';
import { requireUser } from '../middleware/requireUser';
import { env } from '../config/env';

const router = Router();

// Require active session
router.use(requireUser);

/**
 * GET /api/queues/metrics
 * Returns real-time BullMQ queue metrics, job counts, active & delayed job inspectors
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const [counts, isPaused, activeJobs, delayedJobs, failedJobs, waitingJobs] = await Promise.all([
      emailQueue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
      emailQueue.isPaused(),
      emailQueue.getActive(0, 15),
      emailQueue.getDelayed(0, 15),
      emailQueue.getFailed(0, 15),
      emailQueue.getWaiting(0, 15),
    ]);

    const formatJob = (job: any) => ({
      id: job.id,
      name: job.name,
      recipient: job.data?.toEmail || 'Unknown',
      subject: job.data?.subject || 'No subject',
      delayMs: job.opts?.delay || 0,
      attemptsMade: job.attemptsMade || 0,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
    });

    res.status(200).json({
      success: true,
      data: {
        queueName: emailQueue.name,
        isPaused,
        counts,
        workerSettings: {
          concurrency: env.WORKER_CONCURRENCY,
          minDelayMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
          maxPerHour: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        },
        jobs: {
          active: activeJobs.map(formatJob),
          delayed: delayedJobs.map(formatJob),
          failed: failedJobs.map(formatJob),
          waiting: waitingJobs.map(formatJob),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/queues/retry-failed
 * Retries all failed jobs in the BullMQ queue
 */
router.post('/retry-failed', async (_req: Request, res: Response) => {
  try {
    const failedJobs = await emailQueue.getFailed(0, 100);
    for (const job of failedJobs) {
      await job.retry();
    }
    res.status(200).json({
      success: true,
      message: `Retried ${failedJobs.length} failed jobs.`,
      count: failedJobs.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/queues/clean
 * Cleans old completed or failed jobs from Redis storage
 */
router.post('/clean', async (_req: Request, res: Response) => {
  try {
    const cleaned = await emailQueue.clean(0, 1000, 'completed');
    res.status(200).json({
      success: true,
      message: `Cleaned ${cleaned.length} completed jobs from queue memory.`,
      count: cleaned.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
