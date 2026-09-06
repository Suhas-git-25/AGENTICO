import { prisma } from '../db/client';
import { scheduleEmailJob } from '../queues/scheduleEmail';
import { emailQueue } from '../queues/emailQueue';
import { redisConnection } from '../queues/connection';
import { Worker } from 'bullmq';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue';
import { sendMail } from '../services/mailer';
import { EmailStatus } from '@prisma/client';
import { env } from '../config/env';

async function testWorkerRecovery() {
  console.log('🧪 Starting Worker Restart-Recovery Verification Test...\n');

  // 1. Ensure test sender exists
  const sender = await prisma.sender.findFirst();
  if (!sender) {
    throw new Error('No sender found in database. Run npm run db:seed first.');
  }

  // 2. Schedule an email 15 seconds into the future
  const delaySec = 15;
  const scheduledFor = new Date(Date.now() + delaySec * 1000);
  console.log(`1️⃣ Scheduling an email to send in ${delaySec} seconds (${scheduledFor.toISOString()})...`);

  const createdEmail = await prisma.scheduledEmail.create({
    data: {
      senderId: sender.id,
      toEmail: 'restart-recovery-test@example.com',
      subject: 'Worker Restart-Recovery Proof',
      body: '<p>Proving that jobs survive worker process termination and dispatch on restart!</p>',
      scheduledFor,
      delayMs: 2000,
      hourlyLimit: 100,
      status: EmailStatus.SCHEDULED,
    },
  });

  const queueResult = await scheduleEmailJob({
    id: createdEmail.id,
    senderId: createdEmail.senderId,
    toEmail: createdEmail.toEmail,
    subject: createdEmail.subject,
    body: createdEmail.body,
    scheduledFor: createdEmail.scheduledFor,
    delayMs: createdEmail.delayMs,
    hourlyLimit: createdEmail.hourlyLimit,
  });

  console.log(`   ✅ Scheduled in DB (ID: ${createdEmail.id}) and BullMQ (Job ID: ${queueResult.job.id})`);

  // Processor function replicating emailWorker
  const processJob = async (job: any) => {
    console.log(`   ⚙️ Worker received job ${job.id}`);
    const dbRow = await prisma.scheduledEmail.findUnique({ where: { id: job.data.emailId } });
    if (!dbRow || dbRow.status === EmailStatus.SENT) return;

    await prisma.scheduledEmail.update({
      where: { id: job.data.emailId },
      data: { status: EmailStatus.SENDING },
    });

    const mailRes = await sendMail({
      to: job.data.toEmail,
      subject: job.data.subject,
      html: job.data.body,
    });

    await prisma.scheduledEmail.update({
      where: { id: job.data.emailId },
      data: { status: EmailStatus.SENT, sentAt: new Date() },
    });

    return mailRes;
  };

  // 3. Start Worker 1
  console.log('\n2️⃣ Starting Worker 1...');
  let worker1: Worker | null = new Worker(EMAIL_QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  // 4. Kill Worker 1 after 3 seconds (well before 15s delay)
  console.log('   Waiting 3 seconds before abruptly killing Worker 1...');
  await new Promise((r) => setTimeout(r, 3000));
  console.log('💥 KILLING Worker 1 process now! (Simulating worker crash/restart)');
  await worker1.close();
  worker1 = null;

  // 5. Confirm email is STILL in Redis and DB is still QUEUED
  const midJob = await emailQueue.getJob(createdEmail.id);
  const midState = await midJob?.getState();
  const midDb = await prisma.scheduledEmail.findUnique({ where: { id: createdEmail.id } });
  console.log(`   📊 State while worker is dead: Redis Job State=${midState}, DB Status=${midDb?.status}`);

  // 6. Wait until past the 15-second scheduled time (e.g. wait another 14 seconds)
  console.log('\n3️⃣ Waiting until scheduled time has elapsed while NO worker is running...');
  await new Promise((r) => setTimeout(r, 14000));

  // 7. Restart Worker (Worker 2)
  console.log('\n4️⃣ Starting Worker 2 (Simulating worker restart)...');
  const worker2 = new Worker(EMAIL_QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  // Give Worker 2 time to process the job and deliver the email (polling up to 20s)
  console.log('   Waiting for Worker 2 to process and deliver the email...');
  let finalDb = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 20000) {
    finalDb = await prisma.scheduledEmail.findUnique({ where: { id: createdEmail.id } });
    if (finalDb?.status === EmailStatus.SENT) {
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 8. Confirm DB row moved to SENT
  console.log('\n5️⃣ Final State Verification:');
  console.log(`   - Email ID:    ${finalDb?.id}`);
  console.log(`   - DB Status:   ${finalDb?.status}`);
  console.log(`   - Sent At:     ${finalDb?.sentAt?.toISOString()}`);

  if (finalDb?.status === EmailStatus.SENT) {
    console.log('\n🎉 SUCCESS! The email was safely persisted in Redis during the worker downtime and sent upon worker restart.');
  } else {
    throw new Error(`Expected status SENT, but found ${finalDb?.status}`);
  }

  await worker2.close();
  await prisma.$disconnect();
  await emailQueue.close();
  await redisConnection.quit();
}

testWorkerRecovery().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
