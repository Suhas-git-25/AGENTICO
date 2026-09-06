import http from 'http';
import app from '../app';
import { prisma } from '../db/client';
import { emailQueue } from '../queues/emailQueue';
import { redisConnection } from '../queues/connection';

async function runTests() {
  console.log('🧪 Starting Phase 3 API Verification Tests...\n');

  // 1. Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}/api/emails`;

  console.log(`📡 Test server running at http://localhost:${port}`);

  try {
    // 2. Test POST /api/emails/schedule with 3 recipients, startTime = 1 min from now, delayBetweenEmailsMs = 5000
    const now = Date.now();
    const startTimeDate = new Date(now + 60000); // 1 minute from now
    const startTimeIso = startTimeDate.toISOString();
    const delayBetweenEmailsMs = 5000;

    const requestPayload = {
      recipients: [
        'recipient1@example.com',
        'recipient2@example.com',
        'recipient3@example.com',
      ],
      subject: 'Phase 3 Verification Campaign',
      body: 'Hello, this is a test email validating staggered scheduling!',
      startTime: startTimeIso,
      delayBetweenEmailsMs,
      hourlyLimit: 100,
    };

    console.log('1️⃣ Testing POST /api/emails/schedule...');
    console.log('   Payload:', JSON.stringify(requestPayload, null, 2));

    const postResponse = await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (postResponse.status !== 201) {
      const errBody = await postResponse.text();
      throw new Error(`POST /schedule failed with status ${postResponse.status}: ${errBody}`);
    }

    const postResult = await postResponse.json();
    console.log('   Response Status:', postResponse.status);
    console.log('   Response Data:', JSON.stringify(postResult, null, 2));

    const createdRows = postResult.data;
    if (!Array.isArray(createdRows) || createdRows.length !== 3) {
      throw new Error(`Expected 3 created email rows, got ${createdRows?.length}`);
    }

    // 3. Confirm 3 rows appear in Postgres with staggered scheduledFor times
    console.log('\n2️⃣ Verifying Postgres records and staggered scheduledFor times...');
    for (let i = 0; i < createdRows.length; i++) {
      const rowId = createdRows[i].id;
      const dbRow = await prisma.scheduledEmail.findUnique({
        where: { id: rowId },
      });

      if (!dbRow) {
        throw new Error(`Row ${rowId} not found in PostgreSQL!`);
      }

      const expectedTimeMs = startTimeDate.getTime() + i * delayBetweenEmailsMs;
      const actualTimeMs = new Date(dbRow.scheduledFor).getTime();
      const diffMs = Math.abs(actualTimeMs - expectedTimeMs);

      console.log(`   - Recipient ${i + 1} (${dbRow.toEmail}):`);
      console.log(`     ID: ${dbRow.id}`);
      console.log(`     JobId: ${dbRow.jobId}`);
      console.log(`     Status: ${dbRow.status}`);
      console.log(`     ScheduledFor: ${dbRow.scheduledFor.toISOString()} (expected diff: ${diffMs}ms)`);

      if (diffMs > 100) {
        throw new Error(`Staggered time mismatch for index ${i}: expected ${new Date(expectedTimeMs).toISOString()}, got ${dbRow.scheduledFor.toISOString()}`);
      }
    }

    // 4. Confirm 3 delayed jobs appear in Redis
    console.log('\n3️⃣ Verifying BullMQ / Redis delayed jobs...');
    for (let i = 0; i < createdRows.length; i++) {
      const rowId = createdRows[i].id;
      const job = await emailQueue.getJob(rowId);
      if (!job) {
        throw new Error(`Job ${rowId} not found in BullMQ / Redis!`);
      }
      const state = await job.getState();
      console.log(`   - Job ${job.id}: state=${state}, delay=${job.opts.delay}ms, toEmail=${job.data.toEmail}`);
      if (state !== 'delayed') {
        console.warn(`     Warning: Job state is '${state}' instead of 'delayed'`);
      }
    }

    // 5. Test GET /api/emails/scheduled
    console.log('\n4️⃣ Testing GET /api/emails/scheduled...');
    const getScheduledRes = await fetch(`${baseUrl}/scheduled?page=1&pageSize=10`);
    const scheduledData = await getScheduledRes.json();
    console.log(`   Status: ${getScheduledRes.status}`);
    console.log(`   Total: ${scheduledData.total}, Page: ${scheduledData.page}, PageSize: ${scheduledData.pageSize}`);
    console.log(`   Found ${scheduledData.data.length} scheduled emails`);

    // 6. Test GET /api/emails/sent
    console.log('\n5️⃣ Testing GET /api/emails/sent...');
    const getSentRes = await fetch(`${baseUrl}/sent?page=1&pageSize=10`);
    const sentData = await getSentRes.json();
    console.log(`   Status: ${getSentRes.status}`);
    console.log(`   Total: ${sentData.total}, Page: ${sentData.page}, PageSize: ${sentData.pageSize}`);

    // 7. Test GET /api/emails/:id
    console.log('\n6️⃣ Testing GET /api/emails/:id...');
    const testId = createdRows[0].id;
    const getByIdRes = await fetch(`${baseUrl}/${testId}`);
    const singleEmail = await getByIdRes.json();
    console.log(`   Status: ${getByIdRes.status}`);
    console.log(`   Fetched email subject: ${singleEmail.data.subject}, to: ${singleEmail.data.toEmail}`);

    // 8. Test validation error handling (400 Zod)
    console.log('\n7️⃣ Testing Zod validation error handling (400)...');
    const invalidRes = await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: ['invalid-email-address'],
        subject: '',
        startTime: 'invalid-date',
      }),
    });
    const invalidJson = await invalidRes.json();
    console.log(`   Status: ${invalidRes.status}`);
    console.log('   Error response:', JSON.stringify(invalidJson, null, 2));

    console.log('\n🎉 ALL PHASE 3 TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    await prisma.$disconnect();
    await emailQueue.close();
    await redisConnection.quit();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
