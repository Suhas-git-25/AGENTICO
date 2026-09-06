async function testDashboard() {
  console.log('🔍 Testing Bull Board Admin Dashboard Endpoint...');

  // 1. Unauthorized request (missing token)
  const unauthRes = await fetch('http://localhost:4000/admin/queues');
  console.log(`   1. Request without token: Status = ${unauthRes.status} (Expected: 401)`);

  // 2. Request with wrong token
  const wrongTokenRes = await fetch('http://localhost:4000/admin/queues?token=wrong-token');
  console.log(`   2. Request with invalid token: Status = ${wrongTokenRes.status} (Expected: 401)`);

  // 3. Authorized request with correct token
  const token = 'admin-reachinbox-secret-token';
  const authRes = await fetch(`http://localhost:4000/admin/queues?token=${token}`);
  console.log(`   3. Request with valid token (?token=${token}): Status = ${authRes.status} (Expected: 200)`);

  const html = await authRes.text();
  const hasUi = html.includes('root') || html.includes('bull-board') || html.includes('BullBoard');
  console.log(`      Contains Bull Board UI elements: ${hasUi}`);

  if (unauthRes.status === 401 && authRes.status === 200) {
    console.log('\n🎉 BULL BOARD ADMIN DASHBOARD IS LIVE AND SECURED!');
  } else {
    throw new Error('Dashboard authorization verification failed.');
  }
}

testDashboard().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
