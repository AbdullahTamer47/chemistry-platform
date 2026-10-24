import https from 'https';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';

const body = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: 'Ping test. Are you online? Answer in 1 word.'
});

const req = https.request('https://agentrouter.org/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'User-Agent': 'opencode/1.0',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
  let data = '';
  res.on('data', chunk => {
    console.log(`Received chunk ${chunk.length} bytes`);
    data += chunk;
  });
  res.on('end', () => {
    console.log('END. Response:', data.slice(0, 300));
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e);
});

req.write(body);
req.end();
