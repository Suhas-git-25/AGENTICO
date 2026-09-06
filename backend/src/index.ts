import app from './app';
import { env } from './config/env';

import { initEmailIndex } from './services/elastic';

// Server initialization
const server = app.listen(env.PORT, async () => {
  console.log(`🚀 ReachInbox Email Scheduler Backend running on port ${env.PORT}`);
  console.log(`📍 Health check: http://localhost:${env.PORT}/health`);
  console.log(`🌐 Allowed frontend origin: ${env.FRONTEND_URL}`);

  // Auto-initialize Elasticsearch index mapping
  await initEmailIndex();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
