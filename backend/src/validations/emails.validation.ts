import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  senderId: z.string().uuid('senderId must be a valid UUID').optional().or(z.string().min(1).optional()),
  recipients: z
    .array(z.string().email('Each recipient must be a valid email address'))
    .min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  startTime: z
    .string()
    .min(1, 'startTime is required')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'startTime must be a valid ISO datetime string',
    }),
  delayBetweenEmailsMs: z.coerce
    .number()
    .min(0, 'delayBetweenEmailsMs must be greater than or equal to 0'),
  hourlyLimit: z.coerce
    .number()
    .int('hourlyLimit must be an integer')
    .positive('hourlyLimit must be greater than 0'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page must be >= 1').default(1),
  pageSize: z.coerce.number().int().min(1, 'pageSize must be >= 1').max(100, 'pageSize max is 100').default(20),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
