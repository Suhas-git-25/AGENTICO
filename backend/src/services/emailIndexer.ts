import { elasticClient, EMAIL_INDEX_NAME } from './elastic';
import { ScheduledEmail } from '@prisma/client';

export interface EmailSearchResult {
  id: string;
  score: number;
}

export interface EmailIndexPayload {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledFor: Date | string;
  sentAt?: Date | string | null;
  senderId: string;
}

/**
 * Idempotently indexes or updates a ScheduledEmail document in Elasticsearch.
 * Using email.id as the document _id guarantees that subsequent status updates (e.g. QUEUED -> SENT)
 * update the existing document rather than creating duplicates.
 */
export async function indexEmail(email: EmailIndexPayload | ScheduledEmail): Promise<void> {
  try {
    await elasticClient.index({
      index: EMAIL_INDEX_NAME,
      id: email.id,
      document: {
        toEmail: email.toEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledFor: email.scheduledFor ? new Date(email.scheduledFor).toISOString() : null,
        sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
        senderId: email.senderId,
      },
    });
  } catch (error: any) {
    // Non-blocking fire-and-forget: Log warning so Elasticsearch failures never crash core email pipelines
    console.warn(`⚠️ [Elasticsearch] Failed to index email '${email.id}':`, error.message);
  }
}

/**
 * Executes a full-text search across subject, body, and toEmail with optional status filtering.
 * Returns ranked matching email IDs along with their relevance scores.
 */
export async function searchEmails(
  query: string,
  statusFilter?: string
): Promise<EmailSearchResult[]> {
  try {
    const mustQueries: any[] = [];

    if (query && query.trim() !== '') {
      mustQueries.push({
        multi_match: {
          query: query.trim(),
          fields: ['subject^3', 'toEmail^2', 'body'],
          fuzziness: 'AUTO',
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    const filterQueries: any[] = [];
    if (statusFilter && statusFilter.trim() !== '') {
      filterQueries.push({
        term: {
          status: statusFilter.toUpperCase(),
        },
      });
    }

    const response = await elasticClient.search({
      index: EMAIL_INDEX_NAME,
      size: 50,
      query: {
        bool: {
          must: mustQueries,
          filter: filterQueries,
        },
      },
    });

    const hits = response.hits?.hits || [];
    return hits.map((hit: any) => ({
      id: hit._id as string,
      score: hit._score || 0,
    }));
  } catch (error: any) {
    console.warn(`⚠️ [Elasticsearch] Search query failed:`, error.message);
    return [];
  }
}
