import { redisConnection } from '../queues/connection';
import { prisma } from '../db/client';

/**
 * Truncates a date down to the start of its hour (e.g. 14:37:22 -> 14:00:00.000Z).
 */
export function getHourWindow(date: Date = new Date()): Date {
  const window = new Date(date);
  window.setMinutes(0, 0, 0);
  return window;
}

/**
 * Asynchronously mirrors the atomic Redis rate limit counter into the Postgres RateLimitCounter table.
 * Executed as a fire-and-forget write so database latency never blocks the fast-path Redis gate.
 */
function syncRateLimitToPostgres(senderId: string, hourWindow: Date, count: number): void {
  prisma.rateLimitCounter
    .upsert({
      where: {
        senderId_hourWindow: {
          senderId,
          hourWindow,
        },
      },
      update: {
        count,
      },
      create: {
        senderId,
        hourWindow,
        count,
      },
    })
    .catch((err) => {
      console.error('⚠️ [RateLimiter] Failed to asynchronously sync rate limit counter to Postgres:', err.message);
    });
}

/**
 * Checks and atomically increments the sender's rate limit for the current hour window.
 *
 * Architecture:
 * - Redis INCR is atomic and acts as the immediate distributed gatekeeper.
 * - If newCount <= limit: Returns allowed = true and mirrors to PostgreSQL.
 * - If newCount > limit: Decrements Redis counter back and returns allowed = false.
 */
export async function checkAndIncrementRateLimit(
  senderId: string,
  limit: number
): Promise<{ allowed: boolean; currentCount: number }> {
  const hourWindow = getHourWindow(new Date());
  const key = `ratelimit:${senderId}:${hourWindow.toISOString()}`;

  // 1. Atomic Redis INCR
  const newCount = await redisConnection.incr(key);

  // 2. Set TTL on first creation (2 hours = 7200 seconds for auto-cleanup)
  if (newCount === 1) {
    await redisConnection.expire(key, 7200);
  }

  // 3. Evaluate limit
  if (newCount <= limit) {
    // Mirror to Postgres asynchronously for durable reporting & auditing
    syncRateLimitToPostgres(senderId, hourWindow, newCount);

    return {
      allowed: true,
      currentCount: newCount,
    };
  }

  // 4. Exceeded: Decrement back because this email will be rescheduled rather than consumed
  await redisConnection.decr(key);

  return {
    allowed: false,
    currentCount: newCount - 1,
  };
}
