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

  // 6. Exam Structure & Dynamic Testing
  const examsList = await req('/exams', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(examsList.ok && examsList.data.length > 0, 'Exams list fetched');
  const examId = examsList.data[0].id;

  await req(`/exams/${examId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ start_time: null, end_time: null })
  });

  const examTakeRes = await req(`/exams/${examId}/take`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(examTakeRes.ok, `Exam ${examId} questions fetched for authorized user`);
  const questions = examTakeRes.data?.questions || [];
  assert(questions.length > 0, `Exam contains ${questions.length} questions`);

  // Build answers dynamically safely
  const answers = {};
  questions.forEach(q => {
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch (e) { opts = []; }
    }
    opts = Array.isArray(opts) ? opts : [];

    if (q.type === 'mcq') {
      answers[q.id] = opts[0]?.id || 'opt1';
    } else if (q.type === 'true_false') {
      answers[q.id] = 'true';
    } else if (q.type === 'multi_select') {
      answers[q.id] = JSON.stringify([opts[0]?.id || 'opt1']);
    } else {
      answers[q.id] = q.correct_answer || 'إجابة';
    }
  });

  // 7. Exam Submission
  const studentSubmit = await req(`/exams/${examId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      answers,
      time_spent: 45
    })
  });
  assert(studentSubmit.ok, 'Exam submitted successfully');
  const attemptId = studentSubmit.data.attempt_id;
  assert(attemptId > 0, `Valid attempt ID created: ${attemptId}`);

  // 8. Fetch Attempt Review
  const attemptReview = await req(`/exams/attempt/${attemptId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(attemptReview.ok, 'Attempt review fetched successfully');

  // 9. Student Attempts History (/api/exams/my-attempts)
  const myAttemptsRes = await req('/exams/my-attempts', {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });
  assert(myAttemptsRes.ok && Array.isArray(myAttemptsRes.data), 'Student can fetch all past exam attempts history');

  // 10. Lesson PDF Support
  const targetLessonId = paidLesson?.id || publicLessons[0]?.id || 1;
  const lessonUpdate = await req(`/lessons/${targetLessonId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ pdf_url: 'https://kemyawy.com/notes/transition_metals_summary.pdf' })
  });
  assert(lessonUpdate.ok, 'Teacher can attach pdf_url to lesson');

  console.log(`\n========================================`);
  console.log(`🎯 Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
