import fs from 'fs';
import path from 'path';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

async function querySol(systemPrompt, userPrompt) {
  console.log(`\n🤖 Calling ${MODEL} on agentrouter.org...`);
  const start = Date.now();
  
  const fullInput = `${systemPrompt}\n\nTask:\n${userPrompt}`;

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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ ${MODEL} responded in ${duration}s`);

  const message = data.output?.find(o => o.type === 'message');
  const textContent = message?.content?.find(c => c.type === 'output_text');
  return textContent?.text || JSON.stringify(data);
}

async function main() {
  if (!fs.existsSync('scratch/sol_audits')) {
    fs.mkdirSync('scratch/sol_audits', { recursive: true });
  }

  console.log('Reading relevant codebase files...');
  const storeLocatorJs = fs.readFileSync('src/pages/storeLocator.js', 'utf8');
  const navbarJs = fs.readFileSync('src/components/navbar.js', 'utf8');
  const mainJs = fs.readFileSync('src/main.js', 'utf8');
  const packagesRoutes = fs.readFileSync('server/routes/packages.js', 'utf8');

  const systemPrompt = `You are gpt-6.1-sol, an elite principal full-stack software engineer and EdTech software architect.
You are conducting a strict, production-grade review and refactoring of the "كيمياوي" (Egyptian Thanawya Amma Chemistry platform by Dr. Ziad Ramzy).

The user reported the following critical issue:
"لما بدوس على دليل المكتبات يوديني للصفحة غريبة ومدخل الادمن في الطالب والموديل مراجعش علىالمشرو كله كامل على بعضه زرار زرار وانت المفروض تخلي الموديل هو اللي يعمل كل حاجه مش انت وعيد رفع كل حاجه تاني ومطورش ولا ضاف تحديثات"

Key problems identified:
1. When navigating to "#/store-locator":
   - For logged-in Teacher/Admin: It shows the app-layout with the teacher sidebar (admin panel tabs), but store-locator is not in the teacher navbar, and the content displays student actions like "شحن المحفظة أونلاين" which links to the student wallet. The admin has no store management capability.
   - For Student / Guest: The layout and navigation must be 100% cleanly separated from any admin elements.
2. In main.js and navbar.js:
   - When a Teacher visits "#/dashboard", it must automatically route to "#/admin", NOT render student dashboard.
   - When a Student visits "#/admin", it must route to "#/dashboard".
   - In navbar.js, teacherNav should cleanly separate Admin Management tabs from Student View preview, and include Bookstore Management under admin controls.
3. In server/routes/packages.js:
   - Provide clean CRUD endpoints for bookstores (Teacher can add/edit/delete bookstores; students can query and rate).

Your task:
Analyze src/pages/storeLocator.js, src/components/navbar.js, src/main.js, and server/routes/packages.js.
Provide the complete, refined, production-grade code for:
1) src/pages/storeLocator.js (Handling both Student view and Teacher Management view seamlessly)
2) src/components/navbar.js (Clean role isolation with store-locator integrated)
3) src/main.js route guards (Strict role redirection)
4) server/routes/packages.js (Teacher bookstore management endpoints)

Give exact, working JavaScript code.`;

  const userPrompt = `Here are the current file contents:

--- src/pages/storeLocator.js ---
${storeLocatorJs}

--- src/components/navbar.js ---
${navbarJs}

--- src/main.js (routing portion) ---
${mainJs.slice(180, 320)}

--- server/routes/packages.js (store endpoints portion) ---
${packagesRoutes.slice(190)}

Please provide your senior architectural audit and exact complete code replacements for these files to completely resolve this issue and elevate the platform UX to world-class level.`;

  try {
    const report = await querySol(systemPrompt, userPrompt);
    fs.writeFileSync('scratch/sol_audits/audit_1_store_locator_and_roles.md', report, 'utf8');
    console.log('Saved to scratch/sol_audits/audit_1_store_locator_and_roles.md');
  } catch (err) {
    console.error('Failed:', err);
  }
}

main();
