import https from 'https';

const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';

const payload = JSON.stringify({
  model: 'gpt-6.1-sol',
  input: 'Say hello in 3 lines of poetry.',
  stream: true
});

function parseSSE(buffer) {
  const parts = buffer.split(/\r?\n\r?\n/);
  const remaining = parts.pop();
  const events = [];

  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    let eventType = 'message';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
      }
    }

    if (dataStr) {
      events.push({ eventType, dataStr });
    }
  }

  return { events, remaining };
}

let buffer = '';
let text = '';

const req = https.request('https://agentrouter.org/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'User-Agent': 'opencode/1.0',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  res.on('data', chunk => {
    buffer += chunk.toString();
    const { events, remaining } = parseSSE(buffer);
    buffer = remaining;

    for (const ev of events) {
      if (ev.dataStr === '[DONE]') continue;
      try {
        const json = JSON.parse(ev.dataStr);
        if (json.type === 'response.output_text.delta' && json.delta) {
          text += json.delta;
          process.stdout.write(json.delta);
        } else if (json.type === 'response.completed') {
          console.log('\n\n--- COMPLETED EVENT PARSED ---');
          console.log('Usage:', json.response?.usage);
        }
      } catch (err) {
        console.error('\nJSON Parse error on dataStr:', err.message);
      }
    }
  });

  res.on('end', () => {
    console.log('\n\n--- END OF STREAM ---');
    console.log('Total text length:', text.length);
  });
});

req.write(payload);
req.end();
