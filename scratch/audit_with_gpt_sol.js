import fs from 'fs';
import path from 'path';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

async function askGptSol(prompt, context = '') {
  console.log(`\n🤖 Calling ${MODEL} via agentrouter.org...`);
  const fullInput = context 
    ? `You are an elite principal full-stack engineer and EdTech platform architect.\n\nContext:\n${context}\n\nTask:\n${prompt}`
    : prompt;

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'opencode/1.0'
    },
    body: JSON.stringify({
      model: MODEL,
      input: fullInput
    })
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`API Error: ${JSON.stringify(data.error)}`);
  }

  const message = data.output?.find(o => o.type === 'message');
  const textContent = message?.content?.find(c => c.type === 'output_text');
  return textContent?.text || JSON.stringify(data);
}

async function runAudit() {
  console.log('========================================================');
  console.log(`🚀 Starting Full Platform Audit using ${MODEL}`);
  console.log('========================================================');

  // Load key files for context
  const serverApp = fs.readFileSync('server/app.js', 'utf8');
  const serverDb = fs.readFileSync('server/db.js', 'utf8');
  const routesAuth = fs.readFileSync('server/routes/auth.js', 'utf8');
  const routesCourses = fs.readFileSync('server/routes/courses.js', 'utf8');
  const routesExams = fs.readFileSync('server/routes/exams.js', 'utf8');
  const courseDetailPage = fs.readFileSync('src/pages/courseDetail.js', 'utf8');

  const context = `
PROJECT SUMMARY:
Platform: "كيمياوي" (Educational Chemistry Platform by Dr. Ziad Ramzy).
Architecture: Vanilla JS/Vite SPA on Frontend, Express + SQLite (with sql.js WASM on Vercel) on Backend.
Routes:
- Courses (catalog, Bassthalk / Mohamed Salah unified curriculum structure)
- Exams & Homeworks (MCQ + Chemistry essay questions, auto-grading + teacher manual grading)
- Authentication (JWT, student role, teacher admin role, Egyptian phone validation)
- Codes & Subscriptions (Course activation codes, 3-month packages, semester packages)

Files provided:
--- server/routes/exams.js ---
${routesExams.slice(0, 3000)}

--- server/routes/courses.js ---
${routesCourses.slice(0, 2500)}

--- server/routes/auth.js ---
${routesAuth.slice(0, 2500)}
`;

  const prompt = `
Please conduct an in-depth senior code review and architectural evaluation of the chemistry platform.
Specifically:
1. Identify any latent bugs, edge cases, or security/data validation vulnerabilities.
2. What are the top 3 high-impact features or performance improvements we should implement right now to make this platform dramatically superior to competitors (like Bassthalk or Thanawya platforms)?
3. Provide concrete code recommendations or solutions.
Answer in clear, structured Arabic or English.
`;

  try {
    const result = await askGptSol(prompt, context);
    console.log('\n📋 GPT-6.1-SOL AUDIT REPORT:\n');
    console.log(result);

    fs.writeFileSync('scratch/gpt_sol_audit_report.md', result, 'utf8');
    console.log('\n💾 Audit report saved to scratch/gpt_sol_audit_report.md');
  } catch (err) {
    console.error('Audit failed:', err);
  }
}

runAudit();
