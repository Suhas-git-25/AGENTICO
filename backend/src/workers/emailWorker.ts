import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/connection';
import { EMAIL_QUEUE_NAME, emailQueue } from '../queues/emailQueue';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { sendMail } from '../services/mailer';
import { checkAndIncrementRateLimit } from '../services/rateLimiter';
import { indexEmail } from '../services/emailIndexer';
import { notifyRateLimitHit } from '../services/slackNotifier';
import { EmailStatus } from '@prisma/client';

export interface EmailJobData {
  emailId: string;
  senderId: string;
  toEmail: string;
  subject: string;
  body: string;
  delayMs: number;
  hourlyLimit: number;
}

// =================================================================================================
// Concurrency & Rate Limiting Architectural Decision:
// Using BullMQ's built-in queue-level `limiter` (e.g., max 1 job per MIN_DELAY_BETWEEN_EMAILS_MS)
// is far superior and safer under concurrency than an `await sleep()` inside the job processor:
// 1. Non-blocking Execution: An `await sleep()` inside a processor ties up active worker concurrency slots,
//    preventing worker threads from executing other available jobs.
// 2. Distributed Rate Enforcement: BullMQ's queue-level limiter leverages Redis token buckets/scripts,
//    guaranteeing that even across multiple concurrent worker processes/instances, the minimum delay
//    between dispatched emails is strictly enforced without race conditions.
// =================================================================================================

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { emailId } = job.data;
    console.log(`\n⚙️ Processing email job [BullMQ Job ID: ${job.id}] for Email ID: ${emailId}`);

    // a. Look up ScheduledEmail in DB
    const dbEmail = await prisma.scheduledEmail.findUnique({
      where: { id: emailId },
      include: {
        sender: true,
      },
    });

    if (!dbEmail) {
      console.warn(`⚠️ ScheduledEmail with ID ${emailId} not found in database. Skipping job.`);
      return { skipped: true, reason: 'Email not found in DB' };
    }

    // Idempotency guard: If already SENT, return immediately (handles restart replays)
    if (dbEmail.status === EmailStatus.SENT) {
      console.log(`✅ Email ${emailId} was already SENT. Skipping to guarantee strict idempotency.`);
      return { skipped: true, reason: 'Already sent' };
    }

    // b. Check hourly rate limit for sender using real atomic Redis & Postgres limiter
    const limitToEnforce = dbEmail.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const rateLimit = await checkAndIncrementRateLimit(dbEmail.senderId, limitToEnforce);

    // c. If rate limit exceeded: Reschedule for the start of the next hour window (preserve order)
    if (!rateLimit.allowed) {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0); // Start of next hour window
      const rescheduleDelayMs = Math.max(0, nextHour.getTime() - Date.now());

      console.warn(
        `⏳ Sender ${dbEmail.senderId} hourly rate limit reached (${rateLimit.currentCount}/${limitToEnforce}). Rescheduling email ${emailId} to ${nextHour.toISOString()}`
      );

      const rescheduledRecord = await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.RESCHEDULED,
          scheduledFor: nextHour,
        },
      });

      // Update Elasticsearch status to RESCHEDULED (fire-and-forget)
      indexEmail(rescheduledRecord).catch(() => {});

      // Dispatch live Slack rate limit alert (fire-and-forget, silent if no integration)
      notifyRateLimitHit(dbEmail.senderId, rateLimit.currentCount, limitToEnforce).catch(() => {});

      // =============================================================================================
      // Job Rescheduling ID Strategy:
      // We use a `-retry-${Date.now()}` suffix on the new BullMQ jobId.
      // BullMQ prevents duplicate job IDs across active/delayed states. Appending a timestamp suffix
      // allows the previous job run to remain in Redis history for auditability while cleanly enqueuing
      // the new delayed job, while PostgreSQL ScheduledEmail.id remains the constant entity reference.
      // =============================================================================================
      const retryJobId = `${emailId}-retry-${Date.now()}`;
      await emailQueue.add('send-email', job.data, {
        jobId: retryJobId,
        delay: rescheduleDelayMs,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      });

      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: { jobId: retryJobId },
      });

      return { rescheduled: true, nextScheduledFor: nextHour.toISOString() };
    }

    // d. If allowed: transition to SENDING, dispatch via Nodemailer
    const sendingEmail = await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENDING,
        attempts: { increment: 1 },
      },
    });

    // Update Elasticsearch status to SENDING (fire-and-forget)
    indexEmail(sendingEmail).catch(() => {});

    try {
      const sendResult = await sendMail({
        to: dbEmail.toEmail,
        subject: dbEmail.subject,
        html: dbEmail.body,
        smtpUser: dbEmail.sender?.smtpUser,
        smtpPass: dbEmail.sender?.smtpPass,
      });

      // On successful dispatch: mark as SENT with timestamp
      const updatedEmail = await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      // Update Elasticsearch status to SENT (fire-and-forget)
      indexEmail(updatedEmail).catch(() => {});

      console.log(`🎉 Successfully delivered email ${emailId} to ${dbEmail.toEmail} at ${updatedEmail.sentAt?.toISOString()}`);
      return {
        success: true,
        emailId,
        messageId: sendResult.messageId,
        previewUrl: sendResult.previewUrl,
      };
    } catch (err: any) {
      console.error(`❌ Failed to send email ${emailId}:`, err.message);

      // Record failure state in Postgres
      const failedEmail = await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: err.message || 'Unknown SMTP dispatch error',
        },
      });

      // Update Elasticsearch status to FAILED (fire-and-forget)
      indexEmail(failedEmail).catch(() => {});

      // Rethrow to trigger BullMQ retry / exponential backoff
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
    limiter: {
      max: 1,
      duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
    },
  }
);

emailWorker.on('completed', (job) => {
  console.log(`✅ Worker completed job ${job.id}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`💥 Worker failed job ${job?.id}:`, err?.message);
});

emailWorker.on('error', (err) => {
  console.error('💥 Worker internal error:', err);
});
