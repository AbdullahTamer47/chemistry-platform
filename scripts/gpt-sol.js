#!/usr/bin/env node

/**
 * =========================================================================
 * GPT-6.1-SOL Live Streaming Interactive Terminal
 * Powered by agentrouter.org & OpenAI Responses SSE Streaming
 * =========================================================================
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import https from 'https';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = process.env.AGENTROUTER_MODEL || 'gpt-6.1-sol';

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

export async function askGptSolStreamLive(prompt, onToken = null) {
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
    let reasoningCount = 0;

    const req = https.request(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'opencode/1.0',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', c => errBody += c);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody}`)));
        return;
      }

      res.on('data', chunk => {
        buffer += chunk.toString();
        const { events, remaining } = parseSSE(buffer);
        buffer = remaining;

        for (const ev of events) {
          if (ev.dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(ev.dataStr);
            if (json.type === 'response.output_item.added' && json.item?.type === 'reasoning') {
              reasoningCount++;
              const curElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
              process.stdout.write(`\r🧠 [${curElapsed}s] جاري التفكير المنطقي العميق (خطوة ${reasoningCount})...`);
            } else if (json.type === 'response.output_text.delta' && json.delta) {
              if (accumulatedText.length === 0) {
                process.stdout.write('\n\n💡 الإجابة والكود:\n----------------------------------------\n');
              }
              accumulatedText += json.delta;
              process.stdout.write(json.delta);
              if (onToken) onToken(json.delta);
            } else if (json.type === 'response.completed') {
              finalUsage = json.response?.usage;
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
        process.stdout.write('\n----------------------------------------\n');
        console.log(`\n🎉 اكتمل الرد في ${elapsed} ثانية!`);
        if (finalUsage) {
          console.log(`📊 التوكنز: ${finalUsage.total_tokens} (إدخال: ${finalUsage.input_tokens} | تفكير: ${finalUsage.output_tokens_details?.reasoning_tokens || 0} | إخراج: ${finalUsage.output_tokens})`);
        }
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

async function main() {
  const args = process.argv.slice(2);

  console.log(`\n===============================================================`);
  console.log(`⚡ GPT-6.1-SOL Live Streaming Terminal (Model: ${MODEL})`);
  console.log(`===============================================================\n`);

  // Option 1: File audit mode via CLI
  // e.g. node scripts/gpt-sol.js --file server/routes/courses.js
  if (args[0] === '--file' && args[1]) {
    const filePath = args[1];
    if (!fs.existsSync(filePath)) {
      console.error(`❌ الملف غير موجود: ${filePath}`);
      process.exit(1);
    }
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const prompt = `Review this file (${filePath}) and write enhancements:\n\`\`\`javascript\n${fileContent}\n\`\`\``;
    console.log(`📁 جاري فحص ومراجعة الملف: ${filePath}...\n`);
    try {
      await askGptSolStreamLive(prompt);
    } catch (err) {
      console.error(`\n❌ خطأ: ${err.message}`);
    }
    return;
  }

  // Option 2: Direct prompt via CLI arguments
  const promptArg = args.join(' ').trim();
  if (promptArg) {
    console.log(`💬 طلبك: ${promptArg}\n`);
    try {
      await askGptSolStreamLive(promptArg);
    } catch (err) {
      console.error(`\n❌ خطأ: ${err.message}`);
    }
    return;
  }

  // Option 3: Interactive REPL mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`أهلاً بك! يمكنك كتابة أي سؤال أو طلب فحص لأي كود وسيقوم ${MODEL} بالرد مباشرة أمامك.`);
  console.log(`اكتب 'exit' أو اضغط Ctrl+C للخروج.\n`);

  const askQuestion = () => {
    rl.question('🤖 أكتب طلبك > ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      console.log(`\n⏳ جارٍ إرسال الطلب إلى ${MODEL}...`);
      try {
        await askGptSolStreamLive(trimmed);
      } catch (err) {
        console.error(`\n❌ خطأ: ${err.message}\n`);
      }

      console.log('');
      askQuestion();
    });
  };

  askQuestion();
}

if (process.argv[1] && process.argv[1].endsWith('gpt-sol.js')) {
  main();
}
