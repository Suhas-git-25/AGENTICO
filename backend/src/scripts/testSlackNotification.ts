import http from 'http';
import { prisma } from '../db/client';
import { notifyRateLimitHit } from '../services/slackNotifier';

async function testSlackNotificationFlow() {
  console.log('================================================================');
  console.log('🔔 Starting Phase 9 Slack Notification & Rate Limit Alert Tests');
  console.log('================================================================\n');

  // 1. Get default sender and user
  const sender = await prisma.sender.findFirst({
    include: { user: true },
  });

  if (!sender) {
    throw new Error('No sender found in database. Run npm run db:seed first.');
  }

  const userId = sender.userId;
  console.log(`👤 Using Sender: ${sender.name} [ID: ${sender.id}] (User ID: ${userId})`);

  // 2. Ensure Slack integration is initially disconnected
  await prisma.slackIntegration.deleteMany({ where: { userId } });
  console.log('\n1️⃣ Testing rate limit hit when NO Slack integration exists...');
  await notifyRateLimitHit(sender.id, 51, 50);
  console.log('   ✅ Handled silently without errors or crashes.');

  // 3. Setup a mock Slack webhook receiver server to capture real live HTTP POST requests
  let receivedPayload: any = null;
  const mockSlackServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      receivedPayload = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
  });

  await new Promise<void>((resolve) => mockSlackServer.listen(0, resolve));
  const port = (mockSlackServer.address() as any).port;
  const mockWebhookUrl = `http://localhost:${port}/services/T000/B000/XXXX`;
  console.log(`\n2️⃣ Created mock Slack webhook receiver at ${mockWebhookUrl}`);

  try {
    // 4. Connect Slack Integration
    console.log('\n3️⃣ Connecting Slack Integration in PostgreSQL...');
    await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        webhookUrl: mockWebhookUrl,
        teamName: 'ReachInbox Growth Workspace',
        accessToken: 'xoxb-mock-access-token',
      },
      create: {
        userId,
        webhookUrl: mockWebhookUrl,
        teamName: 'ReachInbox Growth Workspace',
        accessToken: 'xoxb-mock-access-token',
      },
    });
    console.log('   ✅ Slack integration row created.');

    // 5. Trigger live rate limit notification
    console.log('\n4️⃣ Triggering live rate limit notification for Sender...');
    receivedPayload = null;
    await notifyRateLimitHit(sender.id, 51, 50);

    // Wait a brief moment for HTTP delivery
    await new Promise((r) => setTimeout(r, 500));

    if (!receivedPayload) {
      throw new Error('No webhook payload received by mock Slack server!');
    }

    console.log('   🎉 Live Slack Webhook Payload Received:');
    console.log('      Text:', receivedPayload.text);
    console.log('      Blocks count:', receivedPayload.blocks?.length);

    // 6. Test Disconnect & Silent Bypass
    console.log('\n5️⃣ Testing Disconnect: deleting Slack integration...');
    await prisma.slackIntegration.deleteMany({ where: { userId } });
    receivedPayload = null;

    console.log('   Triggering rate limit after disconnect...');
    await notifyRateLimitHit(sender.id, 52, 50);
    await new Promise((r) => setTimeout(r, 500));

    if (receivedPayload !== null) {
      throw new Error('Notification was sent even after Slack was disconnected!');
    }
    console.log('   ✅ Confirmed: No message sent when disconnected.');

    // 7. Test Reconnect
    console.log('\n6️⃣ Testing Reconnect: adding Slack integration back...');
    await prisma.slackIntegration.create({
      data: {
        userId,
        webhookUrl: mockWebhookUrl,
        teamName: 'ReachInbox Growth Workspace',
        accessToken: 'xoxb-mock-access-token',
      },
    });

    console.log('   Triggering rate limit after reconnect...');
    await notifyRateLimitHit(sender.id, 53, 50);
    await new Promise((r) => setTimeout(r, 500));

    if (!receivedPayload) {
      throw new Error('Notification failed to send after reconnecting Slack!');
    }
    console.log('   🎉 Reconnect verified! Webhook alert received successfully.');

    console.log('\n🎉 ALL SLACK OAUTH & RATE LIMIT NOTIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    mockSlackServer.close();
    await prisma.$disconnect();
  }
}

testSlackNotificationFlow().catch((err) => {
  console.error('❌ Slack test failed:', err);
  process.exit(1);
});
