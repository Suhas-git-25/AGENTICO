import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Request, Response, NextFunction } from 'express';
import { emailQueue } from './emailQueue';
import { env } from '../config/env';

// 1. Setup Express Adapter with base path
export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// 2. Initialize Bull Board with BullMQ email queue
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

/**
 * Middleware to protect the admin dashboard route with ADMIN_DASHBOARD_TOKEN.
 * Supports token via query string (?token=...) or 'x-admin-token' header.
 */
export const adminDashboardAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = (req.query.token as string) || (req.headers['x-admin-token'] as string);

  // If already authenticated in session/cookie or token matches
  if (token && token === env.ADMIN_DASHBOARD_TOKEN) {
    return next();
  }

  // If static assets (CSS/JS) inside /admin/queues requested after initial auth or with referer holding token
  const referer = req.headers.referer || '';
  if (referer.includes(`token=${env.ADMIN_DASHBOARD_TOKEN}`)) {
    return next();
  }

  res.status(401).send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>401 Unauthorized - BullMQ Dashboard</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #090d16;
            color: #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: #131b2e;
            border: 1px solid #1e293b;
            padding: 2.5rem;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            text-align: center;
            max-width: 480px;
          }
          h1 { color: #f43f5e; font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          code { background: #1e293b; color: #38bdf8; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔒 Admin Access Required</h1>
          <p>Please access the BullMQ live dashboard with your admin token:</p>
          <p><code>/admin/queues?token=${env.ADMIN_DASHBOARD_TOKEN}</code></p>
        </div>
      </body>
    </html>
  `);
};

export const queueDashboardRouter = serverAdapter.getRouter();
