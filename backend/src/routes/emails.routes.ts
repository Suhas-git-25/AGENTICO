import { Router } from 'express';
import {
  scheduleEmail,
  getScheduledEmails,
  getSentEmails,
  searchEmails,
  getEmailById,
} from '../controllers/emails.controller';
import { requireUser } from '../middleware/requireUser';

const router = Router();

// Protect all /api/emails routes with Passport session verification
router.use(requireUser);

// POST /api/emails/schedule - Batch schedule emails with staggered delays
router.post('/schedule', scheduleEmail);

// GET /api/emails/scheduled - List SCHEDULED/QUEUED/RESCHEDULED/SENDING emails
router.get('/scheduled', getScheduledEmails);

// GET /api/emails/sent - List SENT/FAILED emails
router.get('/sent', getSentEmails);

// GET /api/emails/search - Full-text search via Elasticsearch + Postgres hydration
router.get('/search', searchEmails);

// GET /api/emails/:id - Fetch single email details (must come after specific subpaths)
router.get('/:id', getEmailById);

export default router;
