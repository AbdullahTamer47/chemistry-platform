import https from 'https';
import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';

const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

const prompt = `You are a Principal Software Architect reviewing an Egyptian Chemistry Learning Platform (كيمياوي).
Here is server/routes/leaderboard.js:
${code}

Review this file and provide:
1. Short analysis of points calculation & ranking flaws.
2. An upgraded, production-ready server/routes/leaderboard.js with:
   - Chemistry Rank titles (مستكشف الذرة -> محترف الروابط -> عالم كيمياء -> عبقري كيمياوي)
   - Proper monthly and all-time query logic
   - Streak calculation based on recent exam attempts
Output code clearly.`;

const payload = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: prompt
});

console.log('Payload size:', payload.length, 'bytes');
console.log('Sending to agentrouter.org...');
const start = Date.now();

const req = https.request('https://agentrouter.org/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'User-Agent': 'opencode/1.0',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode} (took ${((Date.now() - start)/1000).toFixed(1)}s)`);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.error('API Error:', parsed.error);
        return;
      }
      const msg = parsed.output?.find(o => o.type === 'message');
      const text = msg?.content?.find(c => c.type === 'output_text')?.text || '';
      console.log('Usage:', parsed.usage);
      console.log('Text length:', text.length);
      fs.writeFileSync('scratch/leaderboard_sol_audit.md', text, 'utf8');
      console.log('Wrote scratch/leaderboard_sol_audit.md successfully!');
    } catch (e) {
      console.error('Parse error:', e, data.slice(0, 200));
    }
  });
});

req.on('error', (e) => console.error('Req error:', e));
req.write(payload);
req.end();
