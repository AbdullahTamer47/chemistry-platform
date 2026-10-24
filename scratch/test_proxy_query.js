import http from 'http';
import fs from 'fs';

async function testProxy() {
  console.log('Sending audit query to OpenCode Proxy on http://127.0.0.1:4141/v1/chat/completions...');

  const prompt = `Review the chemistry platform and specifically provide:
1. Complete code for src/pages/storeLocator.js that cleanly separates Student view and Teacher/Admin management.
2. Complete code for src/components/navbar.js that ensures strict role isolation.
3. Strict router guards in src/main.js preventing any admin pages from rendering for students and preventing student pages from rendering with admin sidebar.
4. CRUD bookstore endpoints in server/routes/packages.js.`;

  const payload = JSON.stringify({
    model: 'gpt-6.1-sol',
    messages: [
      { role: 'user', content: prompt }
    ],
    stream: true
  });

  const req = http.request('http://127.0.0.1:4141/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log(`HTTP Status: ${res.statusCode}`);
    let fullText = '';

    res.on('data', chunk => {
      const str = chunk.toString();
      const lines = str.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            process.stdout.write(delta);
            fullText += delta;
          } catch (e) {}
        }
      }
    });

    res.on('end', () => {
      console.log('\n\n--- Finished Receiving Stream ---');
      fs.writeFileSync('scratch/sol_audits/streamed_sol_audit.md', fullText, 'utf8');
      console.log('Saved to scratch/sol_audits/streamed_sol_audit.md');
    });
  });

  req.on('error', err => {
    console.error('Request error:', err);
  });

  req.write(payload);
  req.end();
}

testProxy();
