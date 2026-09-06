import Redis from 'ioredis';
import { env } from '../config/env';

function getCleanRedisUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  if (cleaned.startsWith('redis-cli --tls -u ')) {
    cleaned = cleaned.replace('redis-cli --tls -u ', '').trim();
  } else if (cleaned.startsWith('redis-cli -u ')) {
    cleaned = cleaned.replace('redis-cli -u ', '').trim();
  }
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.includes('upstash.io') && cleaned.startsWith('redis://')) {
    cleaned = cleaned.replace('redis://', 'rediss://');
  }
  return cleaned;
}

const cleanedRedisUrl = getCleanRedisUrl(env.REDIS_URL);

export const redisConnection = new Redis(cleanedRedisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: cleanedRedisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

redisConnection.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

export default redisConnection;
