import { emailQueue } from './emailQueue';
import { prisma } from '../db/prisma';

export interface ScheduleEmailPayload {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  senderId: string;
  scheduledFor: Date;
  delayMs: number;
  hourlyLimit: number;
}

// =================================================================================================
// Architectural Decision:
// removeOnComplete and removeOnFail are intentionally set to false so that we retain full job history
// in Redis for the "restart doesn't lose state" requirement. We reconcile against PostgreSQL as the
// ultimate source of truth (BullMQ acts as the distributed scheduler, and Postgres acts as the ledger).
// =================================================================================================

export async function scheduleEmailJob(scheduledEmail: ScheduleEmailPayload) {
  const scheduledTimeMs = new Date(scheduledEmail.scheduledFor).getTime();
  const delay = Math.max(0, scheduledTimeMs - Date.now());

  let job;
  try {
    // jobId = scheduledEmail.id guarantees idempotency at the queue level.
    // If an email is scheduled multiple times, BullMQ deduplicates by jobId.
    job = await emailQueue.add(
      'send-email',
      {
        emailId: scheduledEmail.id,
        senderId: scheduledEmail.senderId,
        toEmail: scheduledEmail.toEmail,
        subject: scheduledEmail.subject,
        body: scheduledEmail.body,
        delayMs: scheduledEmail.delayMs,
        hourlyLimit: scheduledEmail.hourlyLimit,
      },
      {
        jobId: scheduledEmail.id,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );
  } catch (err: any) {
    // If the job already exists with this ID in BullMQ, retrieve it rather than failing
    const existingJob = await emailQueue.getJob(scheduledEmail.id);
    if (existingJob) {
      job = existingJob;
    } else {
      throw err;
    }
  }

  // Update ScheduledEmail record in Postgres as QUEUED with the assigned jobId
  const updatedEmail = await prisma.scheduledEmail.update({
    where: { id: scheduledEmail.id },
    data: {
      jobId: job.id,
      status: 'QUEUED',
    },
  });

  return {
    job,
    email: updatedEmail,
    delayMs: delay,
  };
}
