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
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('OUTPUT ARRAY:');
    json.output?.forEach((item, idx) => {
      console.log(`[Item ${idx}] type=${item.type}`);
      if (item.content) {
        item.content.forEach((c, cidx) => {
          console.log(`  [Content ${cidx}] type=${c.type}`);
          if (c.type === 'thought') {
            console.log(`    THOUGHT (${c.thought?.length} chars):`, c.thought?.slice(0, 100));
          } else if (c.type === 'output_text') {
            console.log(`    OUTPUT:`, c.text);
          }
        });
      }
    });
    console.log('USAGE:', json.usage);
  });
});

req.write(body);
req.end();
