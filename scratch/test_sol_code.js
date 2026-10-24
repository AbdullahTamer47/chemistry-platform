import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';

async function testLeaderboard() {
  const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');
  console.log(`Code size: ${code.length} chars`);

  const prompt = `You are a Principal Software Architect reviewing an Egyptian Chemistry Learning Platform (كيمياوي).
Here is the code of server/routes/leaderboard.js:
\`\`\`javascript
${code}
\`\`\`

Review this file:
1. Identify any flaws or limitations in the ranking calculation (points, accuracy, streaks).
2. Write an improved replacement implementation with:
   - Rank calculation based on total exam score + streak bonus
   - Chemistry rank tiers (e.g. باحث مبتدئ -> عالم كيمياء -> نابغة الكيمياء)
   - Proper monthly / all-time filtering
Provide clean, production-ready JavaScript code.`;

  console.log('Sending to gpt-6.1-sol...');
  const start = Date.now();
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'opencode/1.0'
    },
    body: JSON.stringify({
      model: 'gpt-6.1-sol',
      input: prompt
    })
  });

  const data = await res.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Elapsed: ${elapsed}s`);
  console.log('Usage:', data.usage);
  if (data.error) {
    console.error('Error:', data.error);
    return;
  }

  const msg = data.output?.find(o => o.type === 'message');
  const text = msg?.content?.find(c => c.type === 'output_text')?.text || '';
  console.log('\n--- Output Preview (first 300 chars) ---');
  console.log(text.slice(0, 300));

  fs.writeFileSync('scratch/leaderboard_sol_audit.md', text, 'utf8');
  console.log('\nSaved to scratch/leaderboard_sol_audit.md');
}

testLeaderboard();
