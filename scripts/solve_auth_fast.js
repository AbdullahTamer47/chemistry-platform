import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

async function askGptSol() {
  console.log(`\n======================================================`);
  console.log(`🤖 Consulting ${MODEL} with effort: low for fast diagnosis...`);
  console.log(`======================================================\n`);

  const prompt = `
A student on our Node/Express + Vercel educational platform gets this error:
"الحساب غير موجود - يرجى تسجيل الدخول مرة أخرى"
(User not found - please log in again).

Root cause:
In server/middleware/auth.js:
resolveUser(token) verifies JWT, then does:
const user = db.prepare('SELECT id, name, role, grade FROM users WHERE id = ?').get(decoded.id);
if (!user) return 401;

On Vercel serverless (Lambda), a fresh container does not have newly registered users in its local SQLite file. But the JWT token is signed and contains { id, role, name, grade }.

Please provide:
1. Short explanation in Arabic.
2. The revised resolveUser(token) function where if db.prepare().get(decoded.id) returns null/undefined, it falls back to the verified decoded payload:
{ id: decoded.id, name: decoded.name, role: decoded.role, grade: decoded.grade }
so verified students are never rejected on serverless.
3. How src/utils/api.js should handle 401 to clear localStorage and redirect to #/login.
`;

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
      reasoning: { effort: 'low' }
    })
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`API Error: ${JSON.stringify(data.error)}`);
  }

  const msg = data.output?.find(o => o.type === 'message');
  const textContent = msg?.content?.find(c => c.type === 'output_text')?.text || '';
  
  console.log(`\n📋 رد وكود الموديل ${MODEL}:\n`);
  console.log(textContent);

  fs.writeFileSync('scratch/gpt_sol_auth_fix.md', textContent, 'utf8');
  console.log('\n💾 Fix saved to scratch/gpt_sol_auth_fix.md');
}

askGptSol().catch(console.error);
