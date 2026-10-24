import https from 'https';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';

const body = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: 'Count from 1 to 5.',
  stream: true
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
  console.log('CONTENT-TYPE:', res.headers['content-type']);
  res.on('data', chunk => {
    console.log('STREAM CHUNK:', chunk.toString().slice(0, 100));
  });
  res.on('end', () => {
    console.log('STREAM COMPLETED');
  });
});

req.write(body);
req.end();
