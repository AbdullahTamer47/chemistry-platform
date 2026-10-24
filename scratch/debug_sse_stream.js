import https from 'https';
import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';

const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

const prompt = `Review this leaderboard route and provide fixes:
\`\`\`js
${code}
\`\`\``;

const payload = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: prompt,
  stream: true
});

console.log('Sending request, size:', payload.length);
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
  console.log(`[${((Date.now() - start)/1000).toFixed(1)}s] Connected! Status: ${res.statusCode}`);
  res.on('data', chunk => {
    console.log(`[${((Date.now() - start)/1000).toFixed(1)}s] Chunk (${chunk.length}b): ${chunk.toString().slice(0, 80).replace(/\n/g, ' ')}`);
  });
  res.on('end', () => {
    console.log(`[${((Date.now() - start)/1000).toFixed(1)}s] Stream ended.`);
  });
});

req.on('error', (e) => console.error('Error:', e));
req.write(payload);
req.end();
