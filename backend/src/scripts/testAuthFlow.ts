import http from 'http';
import app from '../app';
import { prisma } from '../db/client';

async function testAuthFlow() {
  console.log('================================================================');
  console.log('🔒 Starting Phase 8 OAuth & Session Authentication Verification');
  console.log('================================================================\n');

  // Check if server is running on 4000 or spin up test server
  let baseUrl = 'http://localhost:4000/api';
  let tempServer: http.Server | null = null;

  try {
    const healthCheck = await fetch('http://localhost:4000/health').catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      tempServer = http.createServer(app);
      await new Promise<void>((resolve) => tempServer!.listen(0, resolve));
      const port = (tempServer.address() as any).port;
      baseUrl = `http://localhost:${port}/api`;
      console.log(`📡 Standalone test server running at http://localhost:${port}`);
    } else {
      console.log('📡 Connected to active backend server at http://localhost:4000');
    }

    // 1. Unauthenticated /api/auth/me
    console.log('\n1️⃣ Testing GET /api/auth/me without session cookie...');
    const unauthMe = await fetch(`${baseUrl}/auth/me`);
    console.log(`   Status: ${unauthMe.status} (Expected: 401)`);
    if (unauthMe.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/auth/me, got ${unauthMe.status}`);
    }

    // 2. Unauthenticated /api/emails/scheduled (protected route)
    console.log('\n2️⃣ Testing GET /api/emails/scheduled without session cookie (requireUser check)...');
    const unauthEmails = await fetch(`${baseUrl}/emails/scheduled`);
    console.log(`   Status: ${unauthEmails.status} (Expected: 401)`);
    if (unauthEmails.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/emails/scheduled, got ${unauthEmails.status}`);
    }

    // 3. Login session creation via /api/auth/dev-login
    console.log('\n3️⃣ Logging in via session endpoint (/api/auth/dev-login)...');
    const loginRes = await fetch(`${baseUrl}/auth/dev-login`, {
      redirect: 'manual', // capture the Set-Cookie header
    });

    const cookieHeader = loginRes.headers.get('set-cookie');
    console.log(`   Login Response Status: ${loginRes.status}`);
    console.log(`   Received Session Cookie: ${cookieHeader ? cookieHeader.split(';')[0] : 'None'}`);

    if (!cookieHeader) {
      throw new Error('No connect.sid session cookie returned from login');
    }

    const sessionCookie = cookieHeader.split(';')[0];

    // 4. Authenticated /api/auth/me with session cookie
    console.log('\n4️⃣ Testing GET /api/auth/me WITH session cookie...');
    const authMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const userData = await authMe.json();
    console.log(`   Status: ${authMe.status} (Expected: 200)`);
    console.log(`   Authenticated User: ${userData.data?.name} (${userData.data?.email}) [ID: ${userData.data?.id}]`);

    if (authMe.status !== 200 || !userData.data?.id) {
      throw new Error('Authenticated /api/auth/me failed');
    }

    // 5. Authenticated /api/emails/scheduled with session cookie
    console.log('\n5️⃣ Testing GET /api/emails/scheduled WITH session cookie...');
    const authEmails = await fetch(`${baseUrl}/emails/scheduled`, {
      headers: { Cookie: sessionCookie },
    });
    const emailData = await authEmails.json();
    console.log(`   Status: ${authEmails.status} (Expected: 200)`);
    console.log(`   Successfully retrieved user email queue (Total: ${emailData.total})`);

    if (authEmails.status !== 200) {
      throw new Error('Authenticated /api/emails/scheduled failed');
    }

    // 6. Logout /api/auth/logout
    console.log('\n6️⃣ Testing POST /api/auth/logout...');
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    console.log(`   Logout Status: ${logoutRes.status} (Expected: 200)`);

    // 7. Verify session is revoked
    console.log('\n7️⃣ Verifying session revocation after logout...');
    const postLogoutMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    console.log(`   Status after logout: ${postLogoutMe.status} (Expected: 401)`);

    if (postLogoutMe.status !== 401) {
      throw new Error('Expected 401 after session was destroyed');
    }

    console.log('\n🎉 ALL AUTHENTICATION & SESSION LIFECYCLE TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (tempServer) {
      tempServer.close();
    }
    await prisma.$disconnect();
  }
}

testAuthFlow().catch((err) => {
  console.error('❌ Auth test failed:', err);
  process.exit(1);
});
