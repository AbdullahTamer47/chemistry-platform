import https from 'https';
import fs from 'fs';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

const payload = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: `Review this: ${code}`,
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
  console.log('Headers:', res.headers);
  res.on('data', c => {
    console.log('RAW DATA CHUNK:', c.toString());
  });
  res.on('end', () => console.log('RAW END'));
});

req.on('error', console.error);
req.write(payload);
req.end();
