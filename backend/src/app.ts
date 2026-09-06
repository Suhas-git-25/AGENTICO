import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from './auth/passport';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { adminDashboardAuth, queueDashboardRouter } from './queues/dashboard';

const app: Application = express();

// Trust proxy in production for secure cookies behind reverse proxies
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 1. CORS Configuration (credentials: true required for session cookies across :3000 and :4000)
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  })
);

// 2. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Session Middleware with 7-day maxAge
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// 4. Passport Authentication Middleware
app.use(passport.initialize());
app.use(passport.session());

// Root health check endpoint for quick uptime/probe checks
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api', apiRoutes);

// Bull Board Admin Queue Dashboard
app.use('/admin/queues', adminDashboardAuth, queueDashboardRouter);

// Fallback 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

export default app;
