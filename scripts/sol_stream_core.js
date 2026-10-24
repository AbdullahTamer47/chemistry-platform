import https from 'https';
import fs from 'fs';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
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

export async function askGptSolStream(prompt, outputFile = null, onDelta = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      input: prompt,
      stream: true
    });

    const startTime = Date.now();
    let accumulatedText = '';
    let finalUsage = null;
    let buffer = '';
    let chunkCount = 0;
    let reasoningSteps = 0;
    let textDeltas = 0;

    console.log(`📡 [GPT-6.1-SOL] جارٍ إرسال الطلب (${Buffer.byteLength(payload)} بايت)...`);

    const req = https.request(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'opencode/1.0',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      const connectElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🔌 [GPT-6.1-SOL] تم الاتصال بنجاح (HTTP ${res.statusCode}) في ${connectElapsed} ثانية.`);

      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', c => errBody += c);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody}`)));
        return;
      }

      res.on('data', chunk => {
        chunkCount++;
        buffer += chunk.toString();
        const { events, remaining } = parseSSE(buffer);
        buffer = remaining;

        for (const ev of events) {
          if (ev.dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(ev.dataStr);

            if (json.type === 'response.created') {
              console.log(`🚀 [GPT-6.1-SOL] بدء جلسة التفكير المنطقي العميق (Model: ${json.response?.model})...`);
            } else if (json.type === 'response.output_item.added' && json.item?.type === 'reasoning') {
              reasoningSteps++;
              const curElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
              console.log(`🧠 [${curElapsed}s] خطوة تفكير منطقي ${reasoningSteps}...`);
            } else if (json.type === 'response.output_text.delta' && json.delta) {
              textDeltas++;
              accumulatedText += json.delta;
              if (outputFile) {
                fs.appendFileSync(outputFile, json.delta, 'utf8');
              }
              if (onDelta) onDelta(json.delta);
              if (textDeltas % 30 === 0) {
                const curElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
                console.log(`✍️ [${curElapsed}s] جاري استلام أسطر الكود (${accumulatedText.length} حرف)...`);
              }
            } else if (json.type === 'response.completed') {
              finalUsage = json.response?.usage;
              console.log('\n✅ [GPT-6.1-SOL] اكتمل التوليد بنجاح!');
            } else if (json.type === 'error' || json.type === 'response.failed') {
              const errMsg = json.error?.message || json.response?.error?.message || JSON.stringify(json);
              reject(new Error(`AgentRouter Error: ${errMsg}`));
            }
          } catch (e) {
            // ignore partial SSE lines
          }
        }
      });

      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        resolve({
          text: accumulatedText,
          usage: finalUsage,
          elapsed: parseFloat(elapsed)
        });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
