import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Use an isolated temporary database for testing
const tempDbPath = path.join(os.tmpdir(), `kimyawy_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
process.env.DB_PATH = tempDbPath;
process.env.JWT_SECRET = 'test_secret_key_for_automated_verification_suite_2026_zra';
process.env.TEACHER_INITIAL_PASSWORD = 'TeacherStrongPassword!2026';

const { default: app } = await import('../server/app.js');
const { default: db } = await import('../server/db.js');
const { parseChemicalFormula, calculateMolarMass, calculateTitration, FIRST_TRANSITION_SERIES } = await import('../src/utils/chemistryCore.js');

const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/api`;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}:`, err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function apiReq(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

console.log('\n🧪 بدء اختبارات منصة كيمياوي الشاملة (Kimyawy Automated Test Suite)...\n');

// 1. Chemistry Core Unit Tests
await test('نواة الحسابات الكيميائية: حساب الكتلة المولية ونسب العناصر وعناصر السلسلة الانتقالية', async () => {
  const fe2o3 = calculateMolarMass('Fe2O3');
  assert.equal(fe2o3.molarMass, 159.69);
  assert.equal(fe2o3.breakdown.length, 2);
  assert.ok(fe2o3.breakdown[0].massPercent > 69 && fe2o3.breakdown[0].massPercent < 71);

  const caoh2 = parseChemicalFormula('Ca(OH)2');
  assert.deepEqual(caoh2, { Ca: 1, O: 2, H: 2 });

  const titr = calculateTitration({ Ma: 0.1, Va: 25, na: 1, Mb: null, Vb: 20, nb: 1 });
  assert.equal(titr.target, 'Mb');
  assert.equal(titr.value, 0.125);

  assert.equal(FIRST_TRANSITION_SERIES.length, 10);
});

// 2. Auto-seeded Curriculum Verification
let courses = [];
await test('التحقق من تهيئة المنهج الدراسي والكورسات الافتراضية تلقائياً', async () => {
  const res = await apiReq('/courses');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data) && res.data.length >= 4, 'Should have at least 4 auto-seeded courses');
  courses = res.data;
});

// 3. Teacher & Student Authentication
let teacherToken = '';
let studentToken = '';
let studentId = 0;

await test('تسجيل الدخول كمعلم وتسجيل طالب جديد والتحقق من رصيد المحفظة في الداشبورد', async () => {
  const tLogin = await apiReq('/auth/login', {
    method: 'POST',
    body: { phone: '01000000000', password: 'TeacherStrongPassword!2026' }
  });
  assert.equal(tLogin.status, 200);
  assert.ok(tLogin.data.token);
  teacherToken = tLogin.data.token;

  const sReg = await apiReq('/auth/register', {
    method: 'POST',
    body: {
      name: 'يوسف أحمد عبدالرحمن',
      phone: '01098765432',
      password: 'StudentStrong!2026',
      grade: 'ثالثة ثانوي',
      parent_phone: '01122334455',
      parent_phone_secondary: '01223344556'
    }
  });
  assert.equal(sReg.status, 200);
  studentToken = sReg.data.token;
  studentId = sReg.data.user.id;

  const dash = await apiReq('/auth/dashboard', { token: studentToken });
  assert.equal(dash.status, 200);
  assert.equal(typeof dash.data.user.balance, 'number');
  assert.equal(dash.data.user.balance, 0);
});

// 4. Free Course Enrollment, Lesson Access, Video Token & Personal Timestamped Notes
await test('الاشتراك في الكورس المجاني، توكن الفيديو، الحفظ، والملاحظات الموقوتة', async () => {
  const freeCourse = courses.find(c => c.is_free === 1);
  assert.ok(freeCourse, 'Free course should exist');

  const enrollRes = await apiReq(`/courses/${freeCourse.id}/enroll`, { method: 'POST', token: studentToken });
  assert.equal(enrollRes.status, 200);

  const detailRes = await apiReq(`/courses/${freeCourse.id}`, { token: studentToken });
  assert.equal(detailRes.status, 200);
  const firstLesson = detailRes.data.chapters[0].items.find(i => i.item_type === 'lesson');
  assert.ok(firstLesson, 'First lesson should exist');

  // Lesson detail should not leak video_url to student before video-token
  const lessonRes = await apiReq(`/lessons/${firstLesson.id}`, { token: studentToken });
  assert.equal(lessonRes.status, 200);
  assert.equal(lessonRes.data.video_url, undefined);

  // Request video token & verify it
  const vtRes = await apiReq(`/lessons/${firstLesson.id}/video-token`, { method: 'POST', token: studentToken });
  assert.equal(vtRes.status, 200);
  assert.ok(vtRes.data.token);
  assert.ok(vtRes.data.video_url);

  const verifyVt = await apiReq(`/lessons/video/${vtRes.data.token}`, { token: studentToken });
  assert.equal(verifyVt.status, 200);
  assert.equal(verifyVt.data.valid, true);

  // Add personal timestamped note
  const noteRes = await apiReq(`/lessons/${firstLesson.id}/notes`, {
    method: 'POST',
    token: studentToken,
    body: { timestamp_sec: 750, content: 'ملاحظة هامة: شذوذ الكروم والنحاس في التوزيع الإلكتروني' }
  });
  assert.equal(noteRes.status, 201);
  assert.equal(noteRes.data.timestamp_sec, 750);

  const listNotes = await apiReq(`/lessons/${firstLesson.id}/notes`, { token: studentToken });
  assert.equal(listNotes.status, 200);
  assert.equal(listNotes.data.length, 1);

  const delNote = await apiReq(`/lessons/${firstLesson.id}/notes/${noteRes.data.id}`, { method: 'DELETE', token: studentToken });
  assert.equal(delNote.status, 200);
});

// 5. Exam Taking, Submission, Certificate Verification & Student Analytics Percentage Check
await test('خوض الامتحان، استخراج وتوثيق الشهادة، والتحقق من دقة النسب المئوية في الإحصائيات', async () => {
  const freeCourse = courses.find(c => c.is_free === 1);
  const detailRes = await apiReq(`/courses/${freeCourse.id}`, { token: studentToken });
  const examItem = detailRes.data.chapters[0].items.find(i => i.item_type === 'exam');
  assert.ok(examItem, 'Exam in free course should exist');

  const takeRes = await apiReq(`/exams/${examItem.id}/take`, { token: studentToken });
  assert.equal(takeRes.status, 200);
  const q = takeRes.data.questions[0];

  // Submit correct answer (100%)
  const subRes = await apiReq(`/exams/${examItem.id}/submit`, {
    method: 'POST',
    token: studentToken,
    body: { answers: { [q.id]: 'opt1' }, time_spent: 45 }
  });
  assert.equal(subRes.status, 200);
  assert.equal(subRes.data.score, 100);
  assert.ok(subRes.data.certificate?.cert_code);

  // Public Certificate Verification
  const verifyCert = await apiReq(`/exams/certificates/verify/${subRes.data.certificate.cert_code}`);
  assert.equal(verifyCert.status, 200);
  assert.equal(verifyCert.data.percentage, 100);

  // Student Analytics should report 100% (not 100 / points * 100 = 5000%!)
  const analytics = await apiReq('/students/analytics', { token: studentToken });
  assert.equal(analytics.status, 200);
  assert.equal(analytics.data.exams.average_percent, 100);
  assert.equal(analytics.data.progression[0].percent, 100);
});

// 6. Adaptive Mistakes Quiz & Server-side Grading
await test('توليد الاختبار العلاجي الذكي وتصحيحه عبر الخادم', async () => {
  const genRes = await apiReq('/exams/adaptive-mistakes-quiz', { method: 'POST', token: studentToken });
  assert.equal(genRes.status, 200);
  assert.ok(genRes.data.questions.length > 0);

  const qIds = genRes.data.questions.map(q => q.id);
  const gradeRes = await apiReq('/exams/adaptive-mistakes-quiz/submit', {
    method: 'POST',
    token: studentToken,
    body: {
      question_ids: qIds,
      answers: { [qIds[0]]: 'opt1' },
      time_spent: 30
    }
  });
  assert.equal(gradeRes.status, 200);
  assert.equal(typeof gradeRes.data.score, 'number');
  assert.equal(gradeRes.data.results.length, qIds.length);
  assert.ok(gradeRes.data.results[0].correct_answer !== undefined, 'Server grading must return correct_answer in review');
});

// 7. Wallet, Vouchers & Package Excess Credit
await test('توليد كارت شحن، الاشتراك في باقة بكارت أعلى قيمة، وإضافة الرصيد المتبقي للمحفظة', async () => {
  const vGen = await apiReq('/payments/vouchers/generate', {
    method: 'POST',
    token: teacherToken,
    body: { count: 1, amount: 500 }
  });
  assert.equal(vGen.status, 201);
  const voucherCode = vGen.data.vouchers[0].code;

  const pkgs = await apiReq('/packages', { token: studentToken });
  assert.equal(pkgs.status, 200);
  const pkg = pkgs.data[0]; // price = 350

  const subPkg = await apiReq(`/packages/${pkg.id}/subscribe`, {
    method: 'POST',
    token: studentToken,
    body: { payment_method: 'voucher', voucher_code: voucherCode }
  });
  assert.equal(subPkg.status, 200);

  // Excess (500 - 350 = 150) should be credited to student wallet!
  const walletRes = await apiReq('/payments/wallet/balance', { token: studentToken });
  assert.equal(walletRes.status, 200);
  assert.equal(walletRes.data.balance, 500 - pkg.price);
});

// 8. Bookstore Rating Accuracy
await test('تقييم المكتبات المعتمدة وحساب المتوسط الفعلي بدقة', async () => {
  const storesRes = await apiReq('/packages/stores/all', { token: studentToken });
  assert.equal(storesRes.status, 200);
  const store = storesRes.data.stores[0];

  const rateRes = await apiReq(`/packages/stores/${store.id}/rate`, {
    method: 'POST',
    token: studentToken,
    body: { rating: 4 }
  });
  assert.equal(rateRes.status, 200);
  assert.equal(rateRes.data.reviews_count, 1);
  assert.equal(rateRes.data.rating, 4);
});

server.close();
try {
  db.pragma('wal_checkpoint(TRUNCATE)');
} catch (e) {}
try { fs.unlinkSync(tempDbPath); } catch (e) {}
try { fs.unlinkSync(`${tempDbPath}-wal`); } catch (e) {}
try { fs.unlinkSync(`${tempDbPath}-shm`); } catch (e) {}

console.log(`\n========================================`);
console.log(`📊 النتيجة النهائية: ${passed} اختبار ناجح | ${failed} فشل`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
process.exit(0);
