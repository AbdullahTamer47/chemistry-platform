import fs from 'fs';
import path from 'path';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

async function queryGptSol(prompt, effort = 'low') {
  console.log(`\n📡 [GPT-6.1-SOL] Sending request to agentrouter.org (effort: ${effort})...`);
  const startTime = Date.now();

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'opencode/1.0'
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      reasoning: { effort }
    })
  });

  const data = await res.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (data.error) {
    throw new Error(`API Error: ${JSON.stringify(data.error)}`);
  }

  const msg = data.output?.find(o => o.type === 'message');
  const text = msg?.content?.find(c => c.type === 'output_text')?.text || '';
  
  console.log(`✅ [GPT-6.1-SOL] Response received in ${elapsed}s (Usage: ${JSON.stringify(data.usage || {})})`);
  return { text, usage: data.usage };
}

async function runComprehensiveReview() {
  console.log('================================================================');
  console.log('🔬 STARTING DEEP MULTI-STAGE PLATFORM AUDIT WITH GPT-6.1-SOL');
  console.log('================================================================');

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // -------------------------------------------------------------
  // STAGE 1: EXAM ENGINE & REAL-TIME GRADING (exams.js)
  // -------------------------------------------------------------
  console.log('\n>>> STAGE 1: Auditing Exam Engine & Auto-Grading Logic...');
  const examsBackend = fs.readFileSync('server/routes/exams.js', 'utf8');
  
  const stage1Prompt = `
You are a Principal Software Architect reviewing an Egyptian Chemistry Educational Platform (كيمياوي - Dr. Ziad Ramzy).
Here is the actual complete code of server/routes/exams.js:

${examsBackend.slice(0, 15000)}

Task for Stage 1:
1. Examine the exam submission, essay grading, timer validation, and attempt calculation logic.
2. Identify any logic flaws, security vulnerabilities (e.g. cheating, time tampering, score inflation), or performance bottlenecks.
3. Recommend 2 concrete code improvements to enhance reliability and student analytics.
Provide your analysis and code snippets in Arabic or English.
`;

  const stage1Result = await queryGptSol(stage1Prompt, 'low');
  totalInputTokens += stage1Result.usage?.input_tokens || 0;
  totalOutputTokens += stage1Result.usage?.output_tokens || 0;
  fs.writeFileSync('scratch/stage1_exam_audit.md', stage1Result.text, 'utf8');

  // -------------------------------------------------------------
  // STAGE 2: CURRICULUM, PACKAGES & COURSES (courses.js & packages.js)
  // -------------------------------------------------------------
  console.log('\n>>> STAGE 2: Auditing Courses & Subscription Packages Architecture...');
  const coursesBackend = fs.readFileSync('server/routes/courses.js', 'utf8');
  const packagesBackend = fs.readFileSync('server/routes/packages.js', 'utf8');

  const stage2Prompt = `
You are auditing the Curriculum and Subscription Packages Architecture.
Here are the server/routes/courses.js and server/routes/packages.js files:

--- server/routes/courses.js ---
${coursesBackend}

--- server/routes/packages.js ---
${packagesBackend}

Task for Stage 2:
1. Check how quarterly (3-month) packages, term packages, and annual courses are handled.
2. Verify role-based authorization (teachers vs enrolled students vs guests).
3. Confirm that video_url and protected materials are NEVER leaked to un-enrolled students.
4. Recommend a high-value feature enhancement for course progress tracking.
Provide your response in Arabic or English.
`;

  const stage2Result = await queryGptSol(stage2Prompt, 'low');
  totalInputTokens += stage2Result.usage?.input_tokens || 0;
  totalOutputTokens += stage2Result.usage?.output_tokens || 0;
  fs.writeFileSync('scratch/stage2_courses_audit.md', stage2Result.text, 'utf8');

  // -------------------------------------------------------------
  // STAGE 3: STUDENT ANALYTICS & DASHBOARD ENHANCEMENTS
  // -------------------------------------------------------------
  console.log('\n>>> STAGE 3: Auditing Student Analytics & Gamification...');
  const studentsBackend = fs.readFileSync('server/routes/students.js', 'utf8');
  const leaderboardBackend = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

  const stage3Prompt = `
You are evaluating the Student Analytics, Gamification, and Leaderboard module.
Here are the files:

--- server/routes/students.js ---
${studentsBackend.slice(0, 8000)}

--- server/routes/leaderboard.js ---
${leaderboardBackend}

Task for Stage 3:
1. How can we make the Leaderboard and Student Analytics significantly more engaging and motivational for Thanawya Amma students?
2. Propose a concrete feature (e.g. Student Streak / Chemistry Mastery Level / Weekly Top Performers Badge) with exact database and route code.
`;

  const stage3Result = await queryGptSol(stage3Prompt, 'low');
  totalInputTokens += stage3Result.usage?.input_tokens || 0;
  totalOutputTokens += stage3Result.usage?.output_tokens || 0;
  fs.writeFileSync('scratch/stage3_analytics_audit.md', stage3Result.text, 'utf8');

  console.log('\n================================================================');
  console.log(`🎉 AUDIT COMPLETE ACROSS ALL STAGES!`);
  console.log(`Total Tokens Processed: ${totalInputTokens} input + ${totalOutputTokens} output = ${totalInputTokens + totalOutputTokens}`);
  console.log('================================================================');
}

runComprehensiveReview().catch(console.error);
