#!/usr/bin/env node

/**
 * =========================================================================
 * GPT-6.1-SOL CLI Runner for Platform Review & Code Assistance
 * Powered by agentrouter.org & OpenAI Responses API (/v1/responses)
 * =========================================================================
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = process.env.AGENTROUTER_BASE_URL || 'https://agentrouter.org/v1/responses';
const MODEL = process.env.AGENTROUTER_MODEL || 'gpt-6.1-sol';

export async function askGptSol(prompt, systemInstruction = '') {
  const fullInput = systemInstruction
    ? `${systemInstruction}\n\nTask:\n${prompt}`
    : prompt;

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'opencode/1.0'
    },
    body: JSON.stringify({
      model: MODEL,
      input: fullInput
    })
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  const message = data.output?.find(o => o.type === 'message');
  const textContent = message?.content?.find(c => c.type === 'output_text');
  return textContent?.text || JSON.stringify(data);
}

async function main() {
  const args = process.argv.slice(2);
  const promptArg = args.join(' ').trim();

  console.log(`\n======================================================`);
  console.log(`⚡ GPT-6.1-SOL CLI Runner (Model: ${MODEL})`);
  console.log(`======================================================\n`);

  if (promptArg) {
    console.log(`💬 السؤال: ${promptArg}\n`);
    console.log(`⏳ جاري التفكير والاتصال بالموديل...`);
    try {
      const answer = await askGptSol(promptArg);
      console.log(`\n💡 إجابة ${MODEL}:\n`);
      console.log(answer);
    } catch (err) {
      console.error(`\n❌ خطأ: ${err.message}`);
    }
    return;
  }

  // Interactive CLI mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`أهلاً بك! يمكنك كتابة أي استفسار أو طلب مراجعة وسيقوم ${MODEL} بالرد.`);
  console.log(`اكتب 'exit' أو اضغط Ctrl+C للخروج.\n`);

  const askQuestion = () => {
    rl.question('🤖 أكتب طلبك > ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      console.log(`\n⏳ جاري المعالجة بواسطة ${MODEL}...`);
      try {
        const answer = await askGptSol(trimmed);
        console.log(`\n💡 الرد:\n${answer}\n`);
      } catch (err) {
        console.error(`\n❌ خطأ: ${err.message}\n`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

if (process.argv[1] && process.argv[1].endsWith('gpt-sol.js')) {
  main();
}
