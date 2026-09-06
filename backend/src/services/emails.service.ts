import crypto from 'crypto';
import { prisma } from '../db/client';
import { emailQueue } from '../queues/emailQueue';
import { ScheduleEmailInput, PaginationQueryInput } from '../validations/emails.validation';
import { EmailStatus } from '@prisma/client';
import { indexEmail, searchEmails as esSearchEmails } from './emailIndexer';

export class EmailsService {
  /**
   * Schedules a batch of emails for given recipients with staggered delays.
   * Scoped to the authenticated user's Senders.
   */
  async scheduleEmails(payload: ScheduleEmailInput, userId?: string) {
    let targetSenderId = payload.senderId;

    if (!targetSenderId) {
      // Find a sender belonging to the logged in user, or default sender
      const userSender = userId
        ? await prisma.sender.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          })
        : null;

      const defaultSender =
        userSender ??
        (await prisma.sender.findFirst({
          orderBy: { createdAt: 'asc' },
        }));

      if (!defaultSender) {
        const error = new Error('No sender found in the database. Please run the seed script.');
        (error as any).statusCode = 404;
        throw error;
      }
      targetSenderId = defaultSender.id;
    } else {
      // Verify the provided sender exists
      const sender = await prisma.sender.findUnique({
        where: { id: targetSenderId },
      });

      if (!sender) {
        const error = new Error(`Sender with ID '${targetSenderId}' does not exist.`);
        (error as any).statusCode = 404;
        throw error;
      }
    }

    const baseStartTimeMs = new Date(payload.startTime).getTime();

    // Prepare staggered email records with deterministic UUIDs
    const emailRowsData = payload.recipients.map((recipient, index) => {
      const id = crypto.randomUUID();
      const scheduledFor = new Date(baseStartTimeMs + index * payload.delayBetweenEmailsMs);
      return {
        id,
        senderId: targetSenderId as string,
        toEmail: recipient,
        subject: payload.subject,
        body: payload.body,
        scheduledFor,
        delayMs: payload.delayBetweenEmailsMs,
        hourlyLimit: payload.hourlyLimit,
        status: EmailStatus.QUEUED,
        jobId: id,
      };
    });

    // 1. Batch insert in PostgreSQL
    await prisma.scheduledEmail.createMany({
      data: emailRowsData,
    });

    // 2. NOTE: BullMQ bulk queue addition happens AFTER the database writes commit
    const bulkJobs = emailRowsData.map((row) => {
      const scheduledTimeMs = row.scheduledFor.getTime();
      const delay = Math.max(0, scheduledTimeMs - Date.now());
      return {
        name: 'send-email',
        data: {
          emailId: row.id,
          senderId: row.senderId,
          toEmail: row.toEmail,
          subject: row.subject,
          body: row.body,
          delayMs: row.delayMs,
          hourlyLimit: row.hourlyLimit,
        },
        opts: {
          jobId: row.id,
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential' as const,
            delay: 5000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      };
    });

    await emailQueue.addBulk(bulkJobs);

    // 3. Asynchronously index newly created emails in Elasticsearch (Fire-and-forget)
    for (const row of emailRowsData) {
      indexEmail(row).catch(() => {});
    }

    const queuedEmails = emailRowsData.map((row) => ({
      id: row.id,
      toEmail: row.toEmail,
      subject: row.subject,
      scheduledFor: row.scheduledFor,
      status: row.status,
    }));

    return queuedEmails;
  }

  /**
   * Retrieves paginated scheduled emails (SCHEDULED, QUEUED, RESCHEDULED, SENDING) scoped to user.
   */
  async getScheduledEmails(query: PaginationQueryInput, userId?: string) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const scheduledStatuses: EmailStatus[] = [
      EmailStatus.SCHEDULED,
      EmailStatus.QUEUED,
      EmailStatus.RESCHEDULED,
      EmailStatus.SENDING,
    ];

    const where: any = {
      status: {
        in: scheduledStatuses,
      },
    };

    if (userId) {
      where.sender = { userId };
    }

    const [total, data] = await Promise.all([
      prisma.scheduledEmail.count({ where }),
      prisma.scheduledEmail.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          scheduledFor: 'desc',
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              smtpUser: true,
              userId: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Retrieves paginated sent/failed emails (SENT, FAILED) scoped to user.
   */
  async getSentEmails(query: PaginationQueryInput, userId?: string) {
    const { page, pageSize } = query;
    const skip = (page - 1) * pageSize;

    const sentStatuses: EmailStatus[] = [EmailStatus.SENT, EmailStatus.FAILED];

    const where: any = {
      status: {
        in: sentStatuses,
      },
    };

    if (userId) {
      where.sender = { userId };
    }

    const [total, data] = await Promise.all([
      prisma.scheduledEmail.count({ where }),
      prisma.scheduledEmail.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { sentAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              smtpUser: true,
              userId: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Retrieves a single scheduled email by ID scoped to user.
   */
  async getEmailById(id: string, userId?: string) {
    const where: any = { id };
    if (userId) {
      where.sender = { userId };
    }

    const email = await prisma.scheduledEmail.findFirst({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            smtpUser: true,
            userId: true,
          },
        },
      },
    });

    if (!email) {
      const error = new Error(`Email with ID '${id}' not found`);
      (error as any).statusCode = 404;
      throw error;
    }

    return email;
  }

  /**
   * Searches emails via Elasticsearch and hydrates the full records from PostgreSQL scoped to user.
   */
  async searchEmails(query: string, statusFilter?: string, userId?: string) {
    const searchResults = await esSearchEmails(query, statusFilter);

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const ids = searchResults.map((r) => r.id);

    const where: any = {
      id: {
        in: ids,
      },
    };

    if (userId) {
      where.sender = { userId };
    }

    const dbEmails = await prisma.scheduledEmail.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            smtpUser: true,
            userId: true,
          },
        },
      },
    });

    const emailMap = new Map(dbEmails.map((email) => [email.id, email]));

    return searchResults
      .map((hit) => emailMap.get(hit.id))
      .filter((email): email is NonNullable<typeof email> => email !== undefined);
  }
}

export const emailsService = new EmailsService();
