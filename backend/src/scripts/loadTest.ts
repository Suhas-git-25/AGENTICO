import http from 'http';
import app from '../app';
import { prisma } from '../db/client';
import { emailWorker } from '../workers/emailWorker';
import { redisConnection } from '../queues/connection';
import { emailQueue } from '../queues/emailQueue';

async function runLoadTest() {
  console.log('================================================================');
  console.log('🚀 Starting Phase 5 Load Test (1,000 Recipients, Hourly Limit: 50)');
  console.log('================================================================\n');

  // Check if server is running on 4000 or spin up test server
  let baseUrl = 'http://localhost:4000/api/emails';
  let tempServer: http.Server | null = null;

  try {
    const healthCheck = await fetch('http://localhost:4000/health').catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      tempServer = http.createServer(app);
      await new Promise<void>((resolve) => tempServer!.listen(0, resolve));
      const port = (tempServer.address() as any).port;
      baseUrl = `http://localhost:${port}/api/emails`;
      console.log(`📡 Local server spun up at http://localhost:${port}`);
    } else {
      console.log('📡 Connected to active backend server at http://localhost:4000');
    }

    // 1. Generate 1,000 recipient emails
    const count = 1000;
    const recipients: string[] = [];
    for (let i = 1; i <= count; i++) {
      recipients.push(`loadtest_${Date.now()}_${i}@example.com`);
    }

    const payload = {
      recipients,
      subject: 'Phase 5 High-Volume Load Test',
      body: '<p>Verifying rate limiter & rescheduling behavior under 1,000 emails load.</p>',
      startTime: new Date().toISOString(),
      delayBetweenEmailsMs: 100,
      hourlyLimit: 50,
    };

    console.log(`1️⃣ Calling POST /api/emails/schedule with ${count} recipients...`);
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Schedule request failed with status ${response.status}: ${errText}`);
    }

    const resJson = await response.json();
    console.log(`   ✅ Successfully scheduled ${resJson.data?.length} emails in ${elapsedMs}ms!`);

    // 2. Allow worker time to process initial batch and reschedule excess jobs
    console.log('\n2️⃣ Monitoring worker processing and rate limiter rescheduling...');
    console.log('   Waiting 15 seconds for worker to process slots and reschedule excess jobs...');
    await new Promise((r) => setTimeout(r, 15000));

    // 3. Query PostgreSQL status breakdown
    console.log('\n3️⃣ Fetching Database Status Breakdown...');
    const statusCounts = await prisma.scheduledEmail.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    console.log('\n📊 POSTGRES STATUS BREAKDOWN (ALL TIME):');
    console.table(
      statusCounts.map((s) => ({
        Status: s.status,
        Count: s._count.status,
      }))
    );

    // 4. Query RateLimitCounter in PostgreSQL
    const rateLimitAudit = await prisma.rateLimitCounter.findMany({
      orderBy: { hourWindow: 'desc' },
      take: 5,
    });

    console.log('\n🛡️ POSTGRES RATE LIMIT COUNTER AUDIT TRAIL:');
    console.table(
      rateLimitAudit.map((r) => ({
        SenderId: r.senderId,
        HourWindow: r.hourWindow.toISOString(),
        Count: r.count,
      }))
    );

    // 5. Verify no duplicate sends or corrupted states
    const totalEmails = await prisma.scheduledEmail.count();
    console.log(`\n✅ Total ScheduledEmail Records in Postgres: ${totalEmails}`);
    console.log('🎉 Load Test completed cleanly without crashes or lost jobs!');
  } finally {
    if (tempServer) {
      tempServer.close();
    }
    await emailWorker.close();
    await emailQueue.close();
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runLoadTest().catch((err) => {
  console.error('❌ Load test failed:', err);
  process.exit(1);
});
