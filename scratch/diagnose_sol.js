const API_KEY = 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';

async function test(name, payload) {
  console.log(`\n--- Test: ${name} ---`);
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'opencode/1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    console.log(`Status: ${res.status}, Elapsed: ${((Date.now() - start)/1000).toFixed(1)}s`);
    if (data.error) {
      console.log('Error:', data.error);
    } else {
      const msg = data.output?.find(o => o.type === 'message');
      const text = msg?.content?.find(c => c.type === 'output_text')?.text || '';
      console.log('Response preview:', text.slice(0, 150));
      console.log('Usage:', data.usage);
    }
  } catch (err) {
    console.error(`Failed after ${((Date.now() - start)/1000).toFixed(1)}s:`, err.name, err.message);
  }
}

async function run() {
  await test('Simple hello without reasoning', {
    model: 'gpt-6.1-sol',
    input: 'Hello, please respond with "Ready to audit".'
  });

  await test('Simple hello WITH reasoning low', {
    model: 'gpt-6.1-sol',
    input: 'Hello, please respond with "Ready with reasoning".',
    reasoning: { effort: 'low' }
  });
}

run();
