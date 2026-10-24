import https from 'https';
import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

const payload = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: `Review this leaderboard code and suggest 2 improvements:
\`\`\`js
${code.slice(0, 1500)}
\`\`\``,
  reasoning: { effort: 'low' },
  stream: true
});

const req = https.request('https://agentrouter.org/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'User-Agent': 'opencode/1.0',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', c => {
    const s = c.toString();
    if (s.includes('error')) console.log('ERROR EVENT:', s);
    if (s.includes('output_text.delta')) process.stdout.write('.');
    if (s.includes('completed')) console.log('\nCOMPLETED!');
  });
  res.on('end', () => console.log('\nEND'));
});

req.on('error', console.error);
req.write(payload);
req.end();
