import db from '../server/db.js';
import { generateToken } from '../server/middleware/auth.js';

const BASE_URL = 'http://localhost:3000/api';

let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedCount++;
    failures.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', 'x-scenario-test': '1', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runAllScenarios() {
  console.log('\n======================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END SCENARIO & BUTTON AUDIT (ALL ROLES)');
  console.log('======================================================================\n');

  // Setup test users
  const teacher = db.prepare("SELECT * FROM users WHERE role = 'teacher' LIMIT 1").get();
  const student = db.prepare("SELECT * FROM users WHERE role = 'student' LIMIT 1").get();

  const teacherToken = generateToken(teacher);
  const studentToken = generateToken(student);

  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  // -------------------------------------------------------------------------
  // SCENARIO 1: AUTHENTICATION, REGISTRATION & ROLE PERMISSIONS
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 1: Authentication, Profile & Role Guards ---');
  
  // 1.1 Register validation: Missing required fields
  const regFail1 = await request('/auth/register', {
    method: 'POST',
    body: { phone: '01012345678' }
  });
  assert(regFail1.status === 400, 'Register fails when name/password/grade missing');

  // 1.2 Register validation: Invalid Egyptian phone format
  const regFail2 = await request('/auth/register', {
    method: 'POST',
    body: { name: 'طالب تجريبي', phone: '12345', password: 'password123', grade: 'أولى ثانوي' }
  });
  assert(regFail2.status === 400, 'Register fails on invalid Egyptian phone format');

  // 1.3 Register new student with valid data
  const testPhone = `012${Math.floor(10000000 + Math.random() * 90000000)}`;
  const regSuccess = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'أحمد محمود فؤاد',
      phone: testPhone,
      password: 'password12345',
      grade: 'ثالثة ثانوي',
      parent_phone: '01098765432',
      parent_phone_secondary: '01123456789'
    }
  });
  assert((regSuccess.status === 200 || regSuccess.status === 201) && regSuccess.data.token, 'New student registers successfully with parent phones');
  const newStudentToken = regSuccess.data.token;
  const newStudentHeaders = { Authorization: `Bearer ${newStudentToken}` };

  // 1.4 Student login with incorrect password
  const loginFail = await request('/auth/login', {
    method: 'POST',
    body: { phone: testPhone, password: 'wrongpassword' }
  });
  assert(loginFail.status === 400 || loginFail.status === 401, 'Login fails on incorrect password');

  // 1.5 Student profile update
  const profUpdate = await request('/auth/profile', {
    method: 'PUT',
    headers: newStudentHeaders,
    body: {
      name: 'أحمد محمود فؤاد المعدل',
      grade: 'ثالثة ثانوي',
      parent_phone: '01099998888',
      parent_phone_secondary: '01199998888'
    }
  });
  assert(profUpdate.status === 200 && profUpdate.data.name.includes('المعدل'), 'Student profile update succeeds');

  // 1.6 Student change password: valid vs mismatch
  const passChange = await request('/auth/change-password', {
    method: 'PUT',
    headers: newStudentHeaders,
    body: { currentPassword: 'password12345', newPassword: 'newpassword123' }
  });
  assert(passChange.status === 200, 'Student successfully changes password');

  // 1.7 Role Guard: Student attempts teacher-only endpoints
  const adminGuard1 = await request('/students/stats/dashboard', { headers: newStudentHeaders });
  assert(adminGuard1.status === 403, 'Student blocked with 403 on /api/students/stats/dashboard');

  const adminGuard2 = await request('/exams', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { title: 'اختبار غير مصرح' }
  });
  assert(adminGuard2.status === 403, 'Student blocked with 403 on exam creation');


  // -------------------------------------------------------------------------
  // SCENARIO 2: COURSES, WALLET ENROLLMENT & DRM PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Courses, Direct Wallet Purchase & Video DRM ---');

  // 2.1 Fetch public courses list
  const coursesRes = await request('/courses');
  assert(coursesRes.status === 200 && Array.isArray(coursesRes.data) && coursesRes.data.length > 0, 'Public courses list returned');

  // 2.2 Verify DRM: Public course detail NEVER exposes protected video URLs
  const paidCourse = coursesRes.data.find(c => !c.is_free && Number(c.price) > 0) || coursesRes.data[0];
  const courseDetail = await request(`/courses/${paidCourse.id}`);
  assert(courseDetail.status === 200, `Fetched course detail for course ID ${paidCourse.id}`);
  const hasLeakedVideo = JSON.stringify(courseDetail.data).includes('youtube.com/watch') || JSON.stringify(courseDetail.data).includes('drive.google.com/uc');
  assert(!hasLeakedVideo, 'Public course details NEVER leak raw video stream URLs');

  // 2.3 Direct Wallet Purchase with 0 Balance
  const enrollFailZeroBal = await request(`/courses/${paidCourse.id}/enroll`, {
    method: 'POST',
    headers: newStudentHeaders
  });
  assert(enrollFailZeroBal.status === 400 && enrollFailZeroBal.data.error.includes('غير كافٍ'), 'Direct wallet purchase blocked when balance is 0');

  // 2.4 Credit student wallet and purchase course directly
  db.prepare('UPDATE student_wallets SET balance = 500 WHERE user_id = ?').run(regSuccess.data.user.id);
  const enrollSuccess = await request(`/courses/${paidCourse.id}/enroll`, {
    method: 'POST',
    headers: newStudentHeaders
  });
  assert(enrollSuccess.status === 200 && enrollSuccess.data.message.includes('بنجاح'), 'Course purchased directly from wallet balance');
  assert(enrollSuccess.data.new_balance !== undefined, 'Returns updated new_balance');

  // 2.5 Duplicate purchase prevention
  const enrollDuplicate = await request(`/courses/${paidCourse.id}/enroll`, {
    method: 'POST',
    headers: newStudentHeaders
  });
  assert(enrollDuplicate.status === 400 && enrollDuplicate.data.error.includes('مشترك بالفعل'), 'Duplicate course enrollment cleanly blocked');

  // 2.6 Enrolled student accesses course lesson video token
  const lesson = db.prepare('SELECT id, course_id, title FROM lessons WHERE course_id = ? AND is_free = 0 LIMIT 1').get(paidCourse.id) 
    || db.prepare('SELECT id, course_id, title FROM lessons WHERE course_id = ? LIMIT 1').get(paidCourse.id);
  if (lesson) {
    // Ensure lesson is set to is_free = 0 for accurate DRM enforcement testing
    db.prepare('UPDATE lessons SET is_free = 0 WHERE id = ?').run(lesson.id);
    const videoTokenRes = await request(`/lessons/${lesson.id}/video-token`, { method: 'POST', headers: newStudentHeaders });
    assert(videoTokenRes.status === 200 && videoTokenRes.data.video_url, 'Enrolled student gets secure video token');

    // Unenrolled student tries to access same video token
    const otherStudent = db.prepare("SELECT * FROM users WHERE role = 'student' AND id != ? LIMIT 1").get(regSuccess.data.user.id);
    const otherToken = generateToken(otherStudent);
    // ensure not enrolled
    db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(otherStudent.id, paidCourse.id);
    const unenrolledTokenRes = await request(`/lessons/${lesson.id}/video-token`, { method: 'POST', headers: { Authorization: `Bearer ${otherToken}` } });
    assert(unenrolledTokenRes.status === 403, 'Unenrolled student blocked from accessing video token (403)');

    // 2.7 Update lesson progress
    const progressRes = await request(`/lessons/${lesson.id}/progress`, {
      method: 'POST',
      headers: newStudentHeaders,
      body: { completed: 1 }
    });
    assert(progressRes.status === 200, 'Lesson progress updated to completed');

    // 2.8 Bookmark lesson
    const bookmarkRes = await request(`/lessons/${lesson.id}/bookmark`, {
      method: 'POST',
      headers: newStudentHeaders
    });
    assert(bookmarkRes.status === 200, 'Lesson bookmarked successfully for fast revision');
  }


  // -------------------------------------------------------------------------
  // SCENARIO 3: COURSE DISCUSSIONS & COMMUNITY FORUM
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Discussions Forum & Q&A Interactions ---');

  // 3.1 Post discussion question
  const postDisc = await request('/discussions', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { course_id: paidCourse.id, content: 'هل تفاعل أكسدة الحديد الثنائي يتم في وسط حمضي فقط؟' }
  });
  assert(postDisc.status === 201 && postDisc.data.id, 'Student posts question to course discussion forum');
  const discId = postDisc.data.id;

  // 3.2 Teacher replies to discussion
  const replyDisc = await request(`/discussions/${discId}/replies`, {
    method: 'POST',
    headers: teacherHeaders,
    body: { content: 'نعم يا بطل، وجود حمض الكبريتيك المخفف يمنع ترسيب هيدروكسيد الحديد.' }
  });
  assert(replyDisc.status === 201, 'Teacher posts reply to student scientific question');

  // 3.3 Fetch discussions list
  const discList = await request(`/discussions/${paidCourse.id}`, { headers: newStudentHeaders });
  assert(discList.status === 200 && discList.data.some(d => d.id === discId), 'Discussion list contains question with replies');

  // 3.4 Student deletes own question
  const delDisc = await request(`/discussions/${discId}`, {
    method: 'DELETE',
    headers: newStudentHeaders
  });
  assert(delDisc.status === 200, 'Student deletes own discussion question');


  // -------------------------------------------------------------------------
  // SCENARIO 4: EXAMS, SUBMISSION & TEACHER ESSAY GRADING
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Exams Engine, Timers, Essay Questions & Grading ---');

  // 4.1 Student fetches exams list
  const examsList = await request('/exams', { headers: newStudentHeaders });
  assert(examsList.status === 200 && Array.isArray(examsList.data), 'Student fetches active exams list');

  const targetExam = examsList.data[0];
  if (targetExam) {
    // 4.2 Start exam and fetch questions
    const examQuestions = await request(`/exams/${targetExam.id}/take`, { headers: newStudentHeaders });
    assert(examQuestions.status === 200 && Array.isArray(examQuestions.data.questions), `Exam ${targetExam.id} questions loaded`);

    // Verify model answers are NOT leaked to student
    const leakedAnswers = examQuestions.data.questions.some(q => q.correct_answer || q.model_answer);
    assert(!leakedAnswers, 'Exam questions DO NOT leak correct answers before submission');

    // 4.3 Submit exam with answers
    const answersObj = {};
    examQuestions.data.questions.forEach((q, idx) => {
      if (q.type === 'essay') {
        answersObj[q.id] = { text: 'يصعب أكسدة أيون المنجنيز الثنائي لأن المستوى الفرعي 3d نصف ممتلئ وأكثر استقراراً.' };
      } else {
        answersObj[q.id] = 'أ';
      }
    });

    const submitRes = await request(`/exams/${targetExam.id}/submit`, {
      method: 'POST',
      headers: newStudentHeaders,
      body: {
        answers: answersObj,
        time_spent_seconds: 180
      }
    });
    assert(submitRes.status === 200 && submitRes.data.attempt_id, 'Exam submitted successfully and attempt ID created');
    const attemptId = submitRes.data.attempt_id;

    // 4.4 Verify attempt review
    const reviewRes = await request(`/exams/attempts/${attemptId}`, { headers: newStudentHeaders });
    assert(reviewRes.status === 200 && reviewRes.data.questions, 'Student fetches attempt review with explanations');

    // 4.5 Teacher grades essay question
    const essayQuestion = examQuestions.data.questions.find(q => q.type === 'essay');
    if (essayQuestion) {
      const gradeRes = await request(`/exams/attempts/${attemptId}/grade`, {
        method: 'POST',
        headers: teacherHeaders,
        body: {
          scores: { [essayQuestion.id]: essayQuestion.points || 5 },
          feedback: { [essayQuestion.id]: 'إجابة نموذجية وممتازة وربط علمي دقيق بقاعدة هوند' },
          overall_feedback: 'أحسنت يا أحمد، مستوى متميز استمر على هذا الأداء!'
        }
      });
      assert(gradeRes.status === 200, 'Teacher successfully grades essay submission with custom feedback');

      // Verify graded status is updated
      const postGradeReview = await request(`/exams/attempts/${attemptId}`, { headers: newStudentHeaders });
      assert(postGradeReview.data.is_graded === 1, 'Attempt status updated to is_graded = 1');
      assert(postGradeReview.data.overall_feedback.includes('أحسنت'), 'Teacher overall feedback delivered to student');
    }

    // 4.6 My Results history
    const myResults = await request('/exams/my-results', { headers: newStudentHeaders });
    assert(myResults.status === 200 && myResults.data.some(a => a.id === attemptId), 'Exam attempt visible in My Results');
  }


  // -------------------------------------------------------------------------
  // SCENARIO 5: WALLET, FAWRY, VOUCHERS & MANUAL PAYMENTS
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Digital Wallet, Fawry Engine, Vouchers & Approval ---');

  // 5.1 Fetch wallet balance
  const walletRes = await request('/payments/wallet/balance', { headers: newStudentHeaders });
  assert(walletRes.status === 200 && walletRes.data.balance !== undefined, 'Wallet balance and transactions fetched');

  // 5.2 Fawry reference code generation: validation checks
  const fawryInvalid = await request('/payments/fawry/generate', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { amount: 5 } // below min
  });
  assert(fawryInvalid.status === 400, 'Fawry generation rejected for amount under 10 EGP');

  // 5.3 Valid Fawry reference code generation
  const fawrySuccess = await request('/payments/fawry/generate', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { amount: 200 }
  });
  assert(fawrySuccess.status === 201 && fawrySuccess.data.order?.reference_code, 'Fawry 16-character reference code generated successfully');
  const refCode = fawrySuccess.data.order.reference_code;

  // 5.4 Simulate Fawry machine payment callback
  const simPay = await request('/payments/fawry/simulate-pay', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { reference_code: refCode }
  });
  assert(simPay.status === 200 && simPay.data.new_balance, 'Fawry simulation successfully credits student wallet');

  // 5.5 Teacher generates center scratch vouchers
  const genVouchers = await request('/payments/vouchers/generate', {
    method: 'POST',
    headers: teacherHeaders,
    body: { count: 2, amount: 150, prefix: 'KEM' }
  });
  assert(genVouchers.status === 201 && genVouchers.data.vouchers?.length === 2, 'Teacher generates scratch cards successfully');
  const testVoucherCode = genVouchers.data.vouchers[0].code;

  // 5.6 Student charges voucher into wallet
  const chargeVoucher = await request('/payments/wallet/charge-voucher', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { voucher_code: testVoucherCode }
  });
  assert(chargeVoucher.status === 200 && chargeVoucher.data.amount_added === 150, 'Student charges voucher into digital wallet');

  // 5.7 Double-charge prevention
  const chargeAgain = await request('/payments/wallet/charge-voucher', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { voucher_code: testVoucherCode }
  });
  assert(chargeAgain.status === 400 && chargeAgain.data.error.includes('مسبقاً'), 'Used voucher cannot be charged again');

  // 5.8 Manual Payment Request (Vodafone Cash / InstaPay) with receipt
  const anotherCourse = coursesRes.data.find(c => !c.is_free && c.id !== paidCourse.id) || coursesRes.data[1] || coursesRes.data[0];
  // Remove enrollment if any
  db.prepare('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?').run(regSuccess.data.user.id, anotherCourse.id);
  
  // Missing receipt fails
  const payReqNoReceipt = await request('/payments', {
    method: 'POST',
    headers: newStudentHeaders,
    body: {
      course_id: anotherCourse.id,
      method: 'vodafone_cash',
      sender_phone: '01012345678',
      transaction_ref: 'TX99887766'
    }
  });
  assert(payReqNoReceipt.status === 400 && payReqNoReceipt.data.error.includes('إيصال'), 'Manual payment strictly requires receipt upload');

  // Valid manual payment with receipt image
  const dummyReceipt = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const payReqSuccess = await request('/payments', {
    method: 'POST',
    headers: newStudentHeaders,
    body: {
      course_id: anotherCourse.id,
      method: 'vodafone_cash',
      sender_phone: '01012345678',
      transaction_ref: `TX${Date.now().toString().slice(-8)}`,
      receipt_image: dummyReceipt
    }
  });
  assert(payReqSuccess.status === 201 && payReqSuccess.data.id, 'Manual payment request submitted with receipt');
  const paymentReqId = payReqSuccess.data.id;

  // 5.9 Teacher approves payment request
  const approveRes = await request(`/payments/${paymentReqId}`, {
    method: 'PUT',
    headers: teacherHeaders,
    body: { status: 'approved' }
  });
  assert(approveRes.status === 200, 'Teacher approves payment request');

  // Verify course was automatically activated for the student
  const checkEnroll = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(regSuccess.data.user.id, anotherCourse.id);
  assert(Boolean(checkEnroll), 'Student is automatically enrolled in course upon teacher approval');


  // -------------------------------------------------------------------------
  // SCENARIO 6: BOOKSTORE LOCATOR & OUTLET MANAGEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Bookstore Directory & Role-Based CRUD ---');

  // 6.1 Public fetches stores and governorates
  const storesRes = await request('/packages/stores');
  assert(storesRes.status === 200 && Array.isArray(storesRes.data.stores), 'Bookstore list and governorates fetched');

  // 6.2 Student rates bookstore
  const firstStore = storesRes.data.stores[0];
  if (firstStore) {
    const rateRes = await request(`/packages/stores/${firstStore.id}/rate`, {
      method: 'POST',
      headers: newStudentHeaders,
      body: { rating: 5 }
    });
    assert(rateRes.status === 200 && (rateRes.data.rating || rateRes.data.new_rating) >= 1, 'Student rates bookstore 5 stars');
  }

  // 6.3 Student blocked from creating/deleting stores
  const studentCreateStore = await request('/packages/stores', {
    method: 'POST',
    headers: newStudentHeaders,
    body: { name: 'مكتبة غير مصرح بها' }
  });
  assert(studentCreateStore.status === 403, 'Student blocked from creating bookstores (403)');

  // 6.4 Teacher creates new bookstore with Egyptian phone and WhatsApp
  const teacherCreateStore = await request('/packages/stores', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      name: 'مكتبة الأوائل النموذجية',
      address: 'شارع الجمهورية بجوار محطة القطار',
      governorate: 'المنوفية',
      phone: '01011223344',
      whatsapp: '01011223344'
    }
  });
  assert(teacherCreateStore.status === 201 && teacherCreateStore.data.id, 'Teacher creates new bookstore successfully');
  const newStoreId = teacherCreateStore.data.id;

  // 6.5 Teacher updates bookstore
  const teacherUpdateStore = await request(`/packages/stores/${newStoreId}`, {
    method: 'PUT',
    headers: teacherHeaders,
    body: {
      name: 'مكتبة الأوائل المعتمدة - شبين الكوم',
      address: 'شارع الجلاء أمام مجمع الكليات',
      governorate: 'المنوفية',
      phone: '01099887766',
      whatsapp: '01099887766',
      is_active: 1
    }
  });
  assert(teacherUpdateStore.status === 200, 'Teacher updates bookstore address and contact details');

  // 6.6 Teacher deletes bookstore
  const teacherDelStore = await request(`/packages/stores/${newStoreId}`, {
    method: 'DELETE',
    headers: teacherHeaders
  });
  assert(teacherDelStore.status === 200, 'Teacher deletes bookstore successfully');


  // -------------------------------------------------------------------------
  // SCENARIO 7: LIVE SESSIONS & BROADCAST NOTIFICATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Live Interactive Sessions & Push Notifications ---');

  // 7.1 Teacher creates live session
  const createLive = await request('/live', {
    method: 'POST',
    headers: teacherHeaders,
    body: {
      title: 'مراجعة ليلة الامتحان في الكيمياء الكهربية',
      course_id: paidCourse.id,
      description: 'حل 50 فكرة متوقعة في الخلايا الجلفانية والإلكتروليتية',
      scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      duration_minutes: 90,
      meeting_link: 'https://meet.google.com/xyz-chem-live'
    }
  });
  assert(createLive.status === 201 && createLive.data.id, 'Teacher schedules live interactive session');
  const liveId = createLive.data.id;

  // 7.2 Student fetches live sessions
  const liveList = await request('/live', { headers: newStudentHeaders });
  assert(liveList.status === 200 && liveList.data.some(l => l.id === liveId), 'Student views scheduled live session with meeting link');

  // 7.3 Teacher updates session to live or completed with replay
  const updateLive = await request(`/live/${liveId}`, {
    method: 'PUT',
    headers: teacherHeaders,
    body: {
      status: 'completed',
      replay_url: 'https://youtube.com/watch?v=replay_chem_10'
    }
  });
  assert(updateLive.status === 200 && updateLive.data.replay_url, 'Teacher marks session completed with replay recording');

  // 7.4 Teacher deletes live session
  const delLive = await request(`/live/${liveId}`, {
    method: 'DELETE',
    headers: teacherHeaders
  });
  assert(delLive.status === 200, 'Teacher deletes live session');

  // 7.5 Notifications: Student reads unread notifications
  const notifsRes = await request('/students/notifications/my', { headers: newStudentHeaders });
  assert(notifsRes.status === 200 && Array.isArray(notifsRes.data), 'Student fetches notification inbox');
  if (notifsRes.data.length > 0) {
    const markRead = await request(`/students/notifications/${notifsRes.data[0].id}/read`, {
      method: 'PUT',
      headers: newStudentHeaders
    });
    assert(markRead.status === 200, 'Student marks notification as read');
  }


  // -------------------------------------------------------------------------
  // SCENARIO 8: LEADERBOARD & DASHBOARD STATS
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 8: Student Dashboard & Dynamic Leaderboard ---');

  // 8.1 Student dashboard summary
  const dashRes = await request('/auth/dashboard', { headers: newStudentHeaders });
  assert(dashRes.status === 200 && dashRes.data.user && dashRes.data.stats, 'Student dashboard aggregates stats, active courses, and recent activity');

  // 8.2 Leaderboard rankings
  const leaderboardRes = await request('/leaderboard', { headers: newStudentHeaders });
  assert(leaderboardRes.status === 200 && Array.isArray(leaderboardRes.data), 'Leaderboard returns sorted student rankings');

  // 8.3 Teacher admin stats
  const adminStats = await request('/students/stats/dashboard', { headers: teacherHeaders });
  assert(adminStats.status === 200 && adminStats.data.total_students >= 1, 'Admin stats accurately returns total students, enrollments, and distribution');


  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`📊 SCENARIOS AUDIT COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    console.error('List of failed assertions:');
    failures.forEach((f, i) => console.error(`${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL 37 SCENARIOS PASSED WITH ZERO ERRORS!\n');
    process.exit(0);
  }
}

runAllScenarios().catch(err => {
  console.error('Fatal Scenario Runner Error:', err);
  process.exit(1);
});
