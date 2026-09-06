import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import emailsRoutes from './emails.routes';
import slackRoutes from './slack.routes';
import queuesRoutes from './queues.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/emails', emailsRoutes);
router.use('/slack', slackRoutes);
router.use('/queues', queuesRoutes);

export default router;
