import { Request, Response, NextFunction } from 'express';
import { emailsService } from '../services/emails.service';
import { scheduleEmailSchema, paginationQuerySchema } from '../validations/emails.validation';

/**
 * POST /api/emails/schedule
 * Staggers and schedules a batch of emails for given recipients
 */
export const scheduleEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = scheduleEmailSchema.parse(req.body);
    const userId = (req.user as any)?.id;
    const createdEmails = await emailsService.scheduleEmails(validatedData, userId);
    res.status(201).json({
      success: true,
      data: createdEmails,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/emails/scheduled
 * Returns paginated emails that are SCHEDULED, QUEUED, RESCHEDULED, or SENDING scoped to current user
 */
export const getScheduledEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = paginationQuerySchema.parse(req.query);
    const userId = (req.user as any)?.id;
    const result = await emailsService.getScheduledEmails(query, userId);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/emails/sent
 * Returns paginated emails that are SENT or FAILED scoped to current user
 */
export const getSentEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = paginationQuerySchema.parse(req.query);
    const userId = (req.user as any)?.id;
    const result = await emailsService.getSentEmails(query, userId);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/emails/search?q=...&status=...
 * Performs full-text search with Elasticsearch and hydrates records from PostgreSQL scoped to user
 */
export const searchEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const userId = (req.user as any)?.id;

    const emails = await emailsService.searchEmails(query, status, userId);
    res.status(200).json({
      success: true,
      data: emails,
      total: emails.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/emails/:id
 * Returns a single email by ID for debugging / inspection scoped to user
 */
export const getEmailById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;
    const email = await emailsService.getEmailById(id, userId);
    res.status(200).json({
      success: true,
      data: email,
    });
  } catch (error) {
    next(error);
  }
};
