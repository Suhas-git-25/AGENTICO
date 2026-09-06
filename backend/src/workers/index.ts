import { emailWorker } from './emailWorker';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { redisConnection } from '../queues/connection';

// Worker initialization
console.log('================================================================');
console.log('👷 ReachInbox Email Scheduler - BullMQ Worker Process');
console.log(`⚡ Concurrency:              ${env.WORKER_CONCURRENCY}`);
console.log(`⏱️ Min Delay Between Emails: ${env.MIN_DELAY_BETWEEN_EMAILS_MS}ms`);
console.log(`📬 Max Emails Per Hour:      ${env.MAX_EMAILS_PER_HOUR_PER_SENDER}`);
console.log(`🔌 Listening to Queue:       email-sending`);
console.log('================================================================\n');

async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 ${signal} received. Gracefully shutting down worker process...`);
  try {
    await emailWorker.close();
    console.log('✅ BullMQ Worker closed.');
    await prisma.$disconnect();
    console.log('✅ Prisma client disconnected.');
    await redisConnection.quit();
    console.log('✅ Redis connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
