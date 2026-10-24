#!/usr/bin/env node

import fs from 'fs';
import https from 'https';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const TARGET_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

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

async function main() {
  console.log('================================================================');
  console.log('🔍 AUDITING STORE LOCATOR [دليل المكتبات ومنافذ الشحن] WITH GPT-6.1 SOL');
  console.log('================================================================');

  const storePageCode = fs.readFileSync('src/pages/storeLocator.js', 'utf8');
  const packagesRoutesCode = fs.readFileSync('server/routes/packages.js', 'utf8');

  const prompt = `You are a Principal Full-Stack Engineer and UX Architect auditing the educational chemistry platform ("كيمياوي").

The user reported: "[دليل المكتبات] مش مظبوط" (The Store Locator / Bookstores Directory is buggy and not right).

Here is the exact frontend code:
\`\`\`javascript:src/pages/storeLocator.js
${storePageCode}
\`\`\`

Here is the backend route code:
\`\`\`javascript:server/routes/packages.js
${packagesRoutesCode}
\`\`\`

Tasks:
1. Discover all bugs, UI/UX issues, layout flaws, state handling defects, and authentication edge cases in the Bookstore Directory (e.g., guest visitors vs logged in students, responsive mobile layout, search by bookstore name/city, Google Maps links, WhatsApp message formatting, error handling, rating interactions).
2. Write the complete, production-ready replacement code for \`src/pages/storeLocator.js\` with state-of-the-art UI/UX, instant live search, governorate tabs, direct Google Maps navigation, click-to-call, click-to-WhatsApp, and seamless support for both logged-in users and guests.
3. If any backend fixes in \`server/routes/packages.js\` are needed, provide them as well.

Produce complete, unabbreviated code.`;

  console.log('📡 Sending to GPT-6.1 Sol with streaming...');
  const startTime = Date.now();

  const payload = JSON.stringify({
    model: MODEL,
    input: prompt,
    reasoning: { effort: 'low' },
    stream: true
  });

  let fullResponse = '';
  let sseBuffer = '';
  let tokenCount = 0;
  let lastBeat = Date.now();

  const req = https.request(TARGET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'opencode/1.0',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    if (res.statusCode !== 200) {
      let err = '';
      res.on('data', c => err += c);
      res.on('end', () => {
        console.error(`❌ HTTP Error ${res.statusCode}:`, err);
        process.exit(1);
      });
      return;
    }

    console.log('✅ Connected to AgentRouter. Stream started...');

    res.on('data', chunk => {
      sseBuffer += chunk.toString();
      const { events, remaining } = parseSSE(sseBuffer);
      sseBuffer = remaining;

      for (const ev of events) {
        if (ev.dataStr === '[DONE]') continue;
        try {
          const json = JSON.parse(ev.dataStr);
          if (json.type === 'response.output_text.delta' && json.delta) {
            fullResponse += json.delta;
            tokenCount++;
            process.stdout.write(json.delta);
          } else if (Date.now() - lastBeat > 5000) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            process.stdout.write(`\r⏳ [Thinking/Reasoning: ${elapsed}s] `);
            lastBeat = Date.now();
          }
        } catch (e) {}
      }
    });

    res.on('end', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n\n🎉 [GPT-6.1-SOL] Completed in ${elapsed}s! Output length: ${fullResponse.length} characters.`);

      fs.mkdirSync('scratch/sol_audits', { recursive: true });
      const outPath = 'scratch/sol_audits/store_locator_fix.md';
      fs.writeFileSync(outPath, fullResponse, 'utf8');
      console.log(`📁 Response saved to ${outPath}`);
    });
  });

  req.on('error', err => {
    console.error('❌ Connection error:', err.message);
  });

  req.write(payload);
  req.end();
}

main().catch(console.error);
