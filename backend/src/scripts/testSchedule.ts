import { prisma } from '../db/prisma';
import { scheduleEmailJob } from '../queues/scheduleEmail';
import { redisConnection } from '../queues/connection';

async function main() {
  console.log('🧪 Starting test schedule script...');

  // 1. Ensure test user exists in Postgres
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test-google-id-12345',
        email: 'test-scheduler@reachinbox.ai',
        name: 'ReachInbox Tester',
      },
    });
    console.log('👤 Created test user:', user.email);
  }

  // 2. Ensure test sender exists
  let sender = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        userId: user.id,
        name: 'Default Sender',
        smtpUser: 'tester@reachinbox.ai',
        smtpPass: 'testpass123',
      },
    });
    console.log('📤 Created test sender:', sender.smtpUser);
  }

  // 3. Create a ScheduledEmail record scheduled 10 seconds from now
  const scheduledFor = new Date(Date.now() + 10000);
  const email = await prisma.scheduledEmail.create({
    data: {
      senderId: sender.id,
      toEmail: 'prospect-recipient@example.com',
      subject: 'Test Email for BullMQ Delayed Queue Verification',
      body: 'Hello, this is a test email scheduled via BullMQ to verify Redis delayed zset!',
      scheduledFor,
      delayMs: 2000,
      hourlyLimit: 200,
      status: 'SCHEDULED',
    },
  });

  console.log(`✉️ Created ScheduledEmail in Postgres [ID: ${email.id}] scheduled for ${scheduledFor.toISOString()}`);

  // 4. Dispatch to BullMQ via scheduleEmailJob
  const result = await scheduleEmailJob({
    id: email.id,
    toEmail: email.toEmail,
    subject: email.subject,
    body: email.body,
    senderId: email.senderId,
    scheduledFor: email.scheduledFor,
    delayMs: email.delayMs,
    hourlyLimit: email.hourlyLimit,
  });

  console.log('✅ Successfully queued job in BullMQ!');
  console.log(`   - Job ID: ${result.job.id}`);
  console.log(`   - Computed Delay: ${result.delayMs} ms (~10 seconds)`);
  console.log(`   - Postgres Email Status: ${result.email.status}`);
}

main()
  .catch((err) => {
    console.error('❌ Error executing test schedule script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redisConnection.quit();
    process.exit(0);
  });
