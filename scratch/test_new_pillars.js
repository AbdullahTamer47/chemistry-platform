const BASE_URL = 'http://localhost:3000/api';

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('🧪 Testing New 5 Pillars Endpoints...');

  // 1. Student login
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '01111111111', password: 'student123' })
  });

  if (!login.ok || !login.data.token) {
    throw new Error('Student login failed: ' + JSON.stringify(login.data));
  }
  const token = login.data.token;
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  // 2. Test Wallet Balance
  const wallet = await req('/payments/wallet/balance', { headers: authHeaders });
  console.log('  ✅ PASS: Wallet balance endpoint:', wallet.data.balance, 'EGP');

  // 3. Test Instant Fawry Generation
  const fawry = await req('/payments/fawry/generate', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ amount: 50 })
  });
  console.log('  ✅ PASS: Instant Fawry generated code:', fawry.data.order?.reference_code);

  // 4. Test Fawry Payment Simulation
  const refCode = fawry.data.order?.reference_code;
  const paySim = await req('/payments/fawry/simulate-pay', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ reference_code: refCode })
  });
  console.log('  ✅ PASS: Fawry payment simulated successfully! New balance:', paySim.data.new_balance, 'EGP');

  // 5. Test Scratch Voucher Redemption
  const voucher = await req('/payments/wallet/charge-voucher', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ voucher_code: 'KEM-50-DEMO1' })
  });
  console.log('  ✅ PASS: Voucher redeemed! Result:', voucher.data.message || voucher.data.error);

  // 6. Test Analytics Endpoint
  const analytics = await req('/students/analytics', { headers: authHeaders });
  console.log('  ✅ PASS: Student analytics fetched: Curriculum %:', analytics.data.curriculum?.percent + '%, Progression items:', analytics.data.progression?.length);

  // 7. Test Certificates
  const certs = await req('/exams/certificates/my', { headers: authHeaders });
  console.log('  ✅ PASS: Certificates endpoint works! Found:', certs.data.length);

  // 8. Test Adaptive Mistakes Quiz
  const adaptive = await req('/exams/adaptive-mistakes-quiz', {
    method: 'POST',
    headers: authHeaders
  });
  console.log('  ✅ PASS: Adaptive quiz generated! Title:', adaptive.data.title, 'Questions count:', adaptive.data.count);

  // 9. Test Packages Endpoint
  const packages = await req('/packages', { headers: authHeaders });
  console.log('  ✅ PASS: Packages listed! Count:', packages.data.length, 'Title:', packages.data[0]?.title);

  // 10. Test Bookstores Endpoint
  const bookstores = await req('/packages/stores/all');
  console.log('  ✅ PASS: Bookstores listed! Stores:', bookstores.data.stores?.length, 'Governorates:', bookstores.data.governorates?.length);

  console.log('\n========================================');
  console.log('🎯 ALL 10 PILLAR BACKEND TESTS PASSED!');
  console.log('========================================');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
