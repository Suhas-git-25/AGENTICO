import http from 'http';
import app from '../app';
import { prisma } from '../db/client';
import { initEmailIndex, elasticClient, EMAIL_INDEX_NAME } from '../services/elastic';
import { redisConnection } from '../queues/connection';
import { emailQueue } from '../queues/emailQueue';

async function testElasticsearchSearch() {
  console.log('================================================================');
  console.log('🔍 Starting Phase 6 Elasticsearch Search Verification Test');
  console.log('================================================================\n');

  // 1. Initialize Elasticsearch index
  await initEmailIndex();

  // 2. Start temporary local test server or connect to port 4000
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

    // 3. Schedule 3 distinct emails with unique subjects and bodies
    console.log('\n1️⃣ Scheduling 3 distinct test emails for Elasticsearch indexing...');

    const email1 = {
      recipients: ['acme-partner@example.com'],
      subject: 'Acme Corp Partnership Proposal 2026',
      body: 'Excited to explore strategic partnership and enterprise cloud synergies with your team.',
      startTime: new Date().toISOString(),
      delayBetweenEmailsMs: 1000,
      hourlyLimit: 100,
    };

    const email2 = {
      recipients: ['billing-client@example.com'],
      subject: 'Urgent: Invoice #88392 Payment Overdue',
      body: 'Please review your monthly enterprise billing invoice and settle the outstanding balance.',
      startTime: new Date().toISOString(),
      delayBetweenEmailsMs: 1000,
      hourlyLimit: 100,
    };

    const email3 = {
      recipients: ['dev-team@example.com'],
      subject: 'Quarterly Engineering Retrospective & Velocity Review',
      body: 'Agenda: Sprint velocity metrics, incident response improvements, and Q4 roadmap priorities.',
      startTime: new Date().toISOString(),
      delayBetweenEmailsMs: 1000,
      hourlyLimit: 100,
    };

    const res1 = await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email1),
    });
    const data1 = await res1.json();
    console.log(`   ✉️ Scheduled Email 1 [ID: ${data1.data[0]?.id}] - "${email1.subject}"`);

    const res2 = await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email2),
    });
    const data2 = await res2.json();
    console.log(`   ✉️ Scheduled Email 2 [ID: ${data2.data[0]?.id}] - "${email2.subject}"`);

    const res3 = await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email3),
    });
    const data3 = await res3.json();
    console.log(`   ✉️ Scheduled Email 3 [ID: ${data3.data[0]?.id}] - "${email3.subject}"`);

    // 4. Force Elasticsearch index refresh so documents are immediately searchable
    try {
      await elasticClient.indices.refresh({ index: EMAIL_INDEX_NAME });
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 1500));

    // 5. Test Search queries
    console.log('\n2️⃣ Testing GET /api/emails/search endpoint with distinct search queries...');

    // Query A: Subject search "Partnership"
    console.log('   🔍 Query: "Partnership"');
    const searchResA = await fetch(`${baseUrl}/search?q=Partnership`);
    const searchDataA = await searchResA.json();
    console.log(`      Found: ${searchDataA.total} matches`);
    if (searchDataA.data?.[0]?.subject.includes('Partnership')) {
      console.log(`      ✅ Matched: "${searchDataA.data[0].subject}" (Recipient: ${searchDataA.data[0].toEmail})`);
    } else {
      throw new Error(`Expected match for 'Partnership', got: ${JSON.stringify(searchDataA)}`);
    }

    // Query B: Subject search "Invoice"
    console.log('\n   🔍 Query: "Invoice"');
    const searchResB = await fetch(`${baseUrl}/search?q=Invoice`);
    const searchDataB = await searchResB.json();
    console.log(`      Found: ${searchDataB.total} matches`);
    if (searchDataB.data?.[0]?.subject.includes('Invoice')) {
      console.log(`      ✅ Matched: "${searchDataB.data[0].subject}" (Recipient: ${searchDataB.data[0].toEmail})`);
    } else {
      throw new Error(`Expected match for 'Invoice', got: ${JSON.stringify(searchDataB)}`);
    }

    // Query C: Body search "velocity"
    console.log('\n   🔍 Query: "velocity" (Searching email body)');
    const searchResC = await fetch(`${baseUrl}/search?q=velocity`);
    const searchDataC = await searchResC.json();
    console.log(`      Found: ${searchDataC.total} matches`);
    if (searchDataC.data?.[0]?.subject.includes('Engineering')) {
      console.log(`      ✅ Matched: "${searchDataC.data[0].subject}" (Recipient: ${searchDataC.data[0].toEmail})`);
    } else {
      throw new Error(`Expected match for 'velocity', got: ${JSON.stringify(searchDataC)}`);
    }

    // Query D: Recipient search "billing-client"
    console.log('\n   🔍 Query: "billing-client" (Searching recipient email)');
    const searchResD = await fetch(`${baseUrl}/search?q=billing-client`);
    const searchDataD = await searchResD.json();
    console.log(`      Found: ${searchDataD.total} matches`);
    if (searchDataD.data?.[0]?.toEmail.includes('billing-client')) {
      console.log(`      ✅ Matched: "${searchDataD.data[0].subject}" (Recipient: ${searchDataD.data[0].toEmail})`);
    } else {
      throw new Error(`Expected match for 'billing-client', got: ${JSON.stringify(searchDataD)}`);
    }

    console.log('\n🎉 ALL ELASTICSEARCH FULL-TEXT SEARCH TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (tempServer) {
      tempServer.close();
    }
    await prisma.$disconnect();
    await emailQueue.close();
    await redisConnection.quit();
  }
}

testElasticsearchSearch().catch((err) => {
  console.error('❌ Elasticsearch test failed:', err);
  process.exit(1);
});
