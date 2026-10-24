import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

async function askGptSol() {
  console.log(`\n======================================================`);
  console.log(`🤖 Consulting ${MODEL} to diagnose and fix the issue...`);
  console.log(`======================================================\n`);

  const authMiddlewareCode = fs.readFileSync('server/middleware/auth.js', 'utf8');
  const apiJsCode = fs.readFileSync('src/utils/api.js', 'utf8');
  const authRoutesCode = fs.readFileSync('server/routes/auth.js', 'utf8');

  const prompt = `
You are a Principal Security & Backend Engineer.
A student on our educational chemistry platform encountered this exact error:
"الحساب غير موجود - يرجى تسجيل الدخول مرة أخرى"
(User not found - please log in again).

Here is the context:
1. The platform is deployed on Vercel Serverless (AWS Lambda).
2. In 'server/middleware/auth.js':
\`\`\`javascript
function resolveUser(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  const user = db.prepare('SELECT id, name, role, grade FROM users WHERE id = ?').get(decoded.id);
  return user || null;
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }
  try {
    const user = resolveUser(authHeader.split(' ')[1]);
    if (!user) return res.status(401).json({ error: 'الحساب غير موجود - يرجى تسجيل الدخول مرة أخرى' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'جلسة غير صالحة - يرجى تسجيل الدخول مرة أخرى' });
  }
}
\`\`\`

3. The Problem in Serverless (Vercel):
- In serverless environments, each lambda container is stateless. When a new student registers or logs in, their JWT is signed with JWT_SECRET containing { id, role, name, grade }.
- However, if the subsequent request (e.g. GET /api/auth/me or GET /api/auth/dashboard) hits a different or fresh serverless lambda instance where the user's ID was not synced into the local SQLite instance, 'db.prepare(...).get(decoded.id)' returns null, throwing 401 "الحساب غير موجود - يرجى تسجيل الدخول مرة أخرى"!
- In addition, on the client side, if an old or stale token is present in localStorage, 'src/utils/api.js' did not automatically clean it up on 401, leaving the student stuck in an error loop.

Please provide:
1. Diagnosis of the root causes.
2. Complete, drop-in replacement code for 'server/middleware/auth.js' that:
   - Encodes { id, role, name, grade } into the JWT.
   - In resolveUser(token): tries the database lookup first. If the DB record is missing (common in serverless cold starts / fresh instances), gracefully falls back to the cryptographically verified JWT payload so verified students are NEVER locked out!
3. Client-side handling in 'src/utils/api.js' to auto-clear localStorage and redirect to login when a 401 session error occurs.

Please write clean, production-ready code with explanations in Arabic.
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
      reasoning: { effort: 'medium' }
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
