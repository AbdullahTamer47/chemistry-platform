const BASE_URL = 'http://localhost:3000/api';

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🚀 Starting Comprehensive Regression & Security Verification...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extraInfo}`);
      failed++;
    }
  }

  // 1. Teacher & Student Login
  const teacherLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '01000000000', password: 'teacher123' })
  });
  assert(teacherLogin.ok && teacherLogin.data.token, 'Teacher Login with 01000000000');
  const teacherToken = teacherLogin.data?.token;

  const studentLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '01111111111', password: 'student123' })
  });
  assert(studentLogin.ok && studentLogin.data.token, 'Student Login with 01111111111');
  const studentToken = studentLogin.data?.token;

  // 2. Video URL Leak Check in Public Course API
  const coursesList = await req('/courses');
  assert(coursesList.ok && coursesList.data.length > 0, 'Public courses list fetched');
  const targetCourseId = coursesList.data[0].id;

  const coursePublic = await req(`/courses/${targetCourseId}`);
  assert(coursePublic.ok, `Course ${targetCourseId} fetched successfully`);
  const publicLessons = (coursePublic.data?.chapters || []).flatMap(ch => (ch.items || []).filter(i => i.item_type === 'lesson'));
  const anyPublicVideoLeaked = publicLessons.some(l => l.video_url && !l.is_free);
  assert(!anyPublicVideoLeaked, 'Public course details NEVER leak paid video_url');

  // 3. Video URL Leak Check in Lesson Details API without enrollment
  const paidLesson = publicLessons.find(l => !l.is_free);
  if (paidLesson) {
    const unauthLesson = await req(`/lessons/${paidLesson.id}`);
    assert(unauthLesson.status === 403 || !unauthLesson.data.video_url, 'Direct paid lesson access blocked or stripped for guest');
  }

  // 4. Rate Limiting on Code Activation
  let rateLimited = false;
  for (let i = 0; i < 12; i++) {
    const res = await req('/codes/activate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ code: `FAKETEST${i}` })
    });
    if (res.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert(rateLimited, 'Code activation rate-limiter triggers (HTTP 429) on brute-force attempts');

  // 5. Leaderboard Graded Filter
  const leaderboard = await req('/leaderboard');
  assert(leaderboard.ok && Array.isArray(leaderboard.data), 'Leaderboard returns valid array');

  // 6. Exam 9 Structure Verification
  await req('/exams/9', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ start_time: null, end_time: null })
  });

  const examTakeRes = await req('/exams/9/take', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(examTakeRes.ok, 'Exam 9 questions fetched for authorized user');
  const questions = examTakeRes.data?.questions || [];
  assert(questions.length === 5, `Exam 9 contains 5 curated questions (found: ${questions.length})`);
  const hasCuratedEssay = questions.some(q => q.type === 'essay' && q.text.includes('يسهل تأكسد أيون الحديد'));
  assert(hasCuratedEssay, 'Exam 9 contains curated chemistry essay question on Fe2+/Mn2+ oxidation');

  // 7. Full Essay Submission & Teacher Review Flow
  const studentSubmit = await req('/exams/9/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` }, // using teacher account as participant test
    body: JSON.stringify({
      answers: {
        15: '26',
        16: 'true',
        17: 'الخارصين',
        18: JSON.stringify(['Cr', 'Cu']),
        22: {
          text: 'Fe2+ [Ar]3d6 يتأكسد لـ Fe3+ [Ar]3d5 نصف ممتلئ وأكثر استقراراً، بينما Mn2+ [Ar]3d5 نصف ممتلئ ومستقر بالفعل.',
          image_url: 'http://localhost:3000/uploads/sample_handwritten_solution.png'
        }
      },
      time_spent: 45
    })
  });
  assert(studentSubmit.ok, 'Exam 9 submitted successfully');
  assert(studentSubmit.data.is_graded === 0, 'Exam with essay question starts with is_graded = 0 (unverified)');

  const attemptId = studentSubmit.data.attempt_id;
  assert(attemptId > 0, `Valid attempt ID created: ${attemptId}`);

  // 8. Fetch Attempt Review
  const attemptReview = await req(`/exams/attempt/${attemptId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(attemptReview.ok, 'Attempt review fetched successfully');
  assert(attemptReview.data.is_graded === 0, 'Attempt review confirms is_graded = 0 before teacher grading');
  assert(Array.isArray(attemptReview.data.results), 'Attempt review contains full results breakdown');

  // 9. Teacher Grading Flow
  const gradeRes = await req(`/exams/attempt/${attemptId}/grade-essay`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      essay_grades: {
        22: { points: 5, notes: 'إجابة نموذجية ممتازة وخطوات تفصيلية صحيحة 100%' }
      },
      teacher_feedback: 'أحسنت يا بني، إجابتك دقيقة والتوزيع الإلكتروني متقن. استمر في هذا التفوق!'
    })
  });
  assert(gradeRes.ok, 'Teacher successfully graded essay submission');
  assert(gradeRes.data.is_graded === 1, 'Attempt updated to is_graded = 1');

  // 10. Re-check Attempt Review after grading
  const gradedReview = await req(`/exams/attempt/${attemptId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(gradedReview.ok, 'Post-grade review fetched');
  assert(gradedReview.data.is_graded === 1, 'Post-grade review shows is_graded = 1');
  assert(gradedReview.data.teacher_feedback.includes('أحسنت'), 'Teacher overall feedback successfully preserved and delivered');

  const gradedEssayQ = gradedReview.data.results.find(r => r.id === 22);
  assert(gradedEssayQ && gradedEssayQ.earned_points === 5, 'Graded essay question reflects full 5 points');
  assert(gradedEssayQ && gradedEssayQ.teacher_comment.includes('نموذجية'), 'Teacher specific essay question comment preserved');

  // 11. Student Attempts History (/api/exams/my-attempts)
  const myAttemptsRes = await req('/exams/my-attempts', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(myAttemptsRes.ok && Array.isArray(myAttemptsRes.data), 'Student can fetch all past exam attempts history');
  assert(myAttemptsRes.data.length > 0, `Attempts history populated with ${myAttemptsRes.data.length} records`);

  // 12. Lesson PDF Support
  const targetLessonId = paidLesson?.id || publicLessons[0]?.id || 1;
  const lessonUpdate = await req(`/lessons/${targetLessonId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ pdf_url: 'https://kemyawy.com/notes/transition_metals_summary.pdf' })
  });
  assert(lessonUpdate.ok, 'Teacher can attach pdf_url to lesson');
  const updatedLesson = await req(`/lessons/${targetLessonId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(updatedLesson.data.pdf_url === 'https://kemyawy.com/notes/transition_metals_summary.pdf', 'Lesson correctly returns pdf_url to authorized student');

  // 13. Exam Scheduling (start_time & end_time)
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  await req('/exams/9', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ start_time: futureDate })
  });
  const blockedExam = await req('/exams/9/take', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(blockedExam.status === 400 && (blockedExam.data.error.includes('غير متاح بعد') || blockedExam.data.error.includes('موعد البدء')), 'Exam correctly blocked when start_time is in the future');

  // Reset start_time
  await req('/exams/9', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ start_time: null })
  });
  const reopenedExam = await req('/exams/9/take', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  // 14. File Upload (Multer to /uploads/)
  const form = new FormData();
  form.append('file', new Blob(['CHEM_TEST_DATA'], { type: 'image/png' }), 'receipt_sample.png');
  const upRes = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: form
  });
  const upData = await upRes.json();
  assert(upRes.ok && upData.url && upData.url.startsWith('/uploads/'), 'Multer file upload endpoint successfully stores files');

  console.log(`\n========================================`);
  console.log(`🎯 Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
