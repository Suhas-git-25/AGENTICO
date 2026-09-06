export type EmailStatus =
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'RESCHEDULED'
  | 'scheduled'
  | 'sent'
  | 'failed';

export type SentEmailStatus = 'SENT' | 'FAILED' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  name: string;
  smtpUser: string;
  userId?: string;
}

export interface ScheduledEmail {
  id: string;
  senderId: string;
  toEmail: string;
  subject: string;
  body: string;
  scheduledFor: string;
  delayMs: number;
  hourlyLimit: number;
  status: EmailStatus;
  jobId?: string | null;
  attempts?: number;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
}

export interface ScheduleEmailRequest {
  senderId?: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface SlackIntegration {
  id: string;
  teamName: string;
  createdAt: string;
}

export interface SlackStatus {
  connected: boolean;
  integration: SlackIntegration | null;
}
