#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const TARGET_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

function collectFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'backups', '.git', 'uploads', 'assets', 'tempmediaStorage'].includes(entry.name)) {
        collectFiles(fullPath, fileList);
      }
    } else if (/\.(js|json|css|html)$/.test(entry.name) && !entry.name.endsWith('.min.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

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
  console.log('📦 GATHERING ENTIRE CODEBASE: server/ and src/');
  console.log('================================================================');

  const serverFiles = collectFiles('server');
  const srcFiles = collectFiles('src');
  const allFiles = [...serverFiles, ...srcFiles];

  console.log(`Found ${serverFiles.length} server files and ${srcFiles.length} src files. Total: ${allFiles.length} files.`);

  let context = '--- ENTIRE CODEBASE FROM server/ AND src/ ---\n\n';
  let totalBytes = 0;

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      totalBytes += Buffer.byteLength(content);
      context += `================================================================================\n`;
      context += `FILE: ${file}\n`;
      context += `================================================================================\n`;
      context += `\`\`\`${file.endsWith('.json') ? 'json' : file.endsWith('.css') ? 'css' : 'javascript'}\n`;
      context += `${content}\n`;
      context += `\`\`\`\n\n`;
    } catch (e) {
      console.warn(`Could not read ${file}: ${e.message}`);
    }
  }

  console.log(`Total payload size: ${(totalBytes / 1024).toFixed(1)} KB`);

  const prompt = `You are a Principal Software Architect and Lead Full-Stack Engineer.
I am handing over the entire chemistry educational platform codebase ("كيمياوي") across the \`server/\` and \`src/\` directories.

You have full authority to handle the codebase as you see fit:
1. Conduct a comprehensive review of the entire platform architecture, database design, authentication, and core business flows.
2. Resolve any and all security flaws, performance bottlenecks, race conditions, and UX defects.
3. Modernize, clean up, and enhance the code.
4. Provide the updated, production-ready code for the files that need modifications, with clear explanations of what you improved.

${context}

Now, analyze everything thoroughly, handle what needs to be handled, and provide your complete review and updated code files.`;

  console.log('\n📡 Sending entire project to GPT-6.1 Sol with streaming...');
  const startTime = Date.now();

  const payload = JSON.stringify({
    model: MODEL,
    input: prompt,
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
        fs.appendFileSync('scratch/raw_sse_log.txt', `[EVENT: ${ev.eventType}] ${ev.dataStr}\n`);
        if (ev.dataStr === '[DONE]') continue;
        try {
          const json = JSON.parse(ev.dataStr);
          if (json.type === 'response.output_text.delta' && json.delta) {
            fullResponse += json.delta;
            tokenCount++;
            process.stdout.write(json.delta);
          } else if (json.type === 'response.completed') {
            console.log('\n[Response Completed Event]:', JSON.stringify(json, null, 2));
            fs.writeFileSync('scratch/response_completed.json', JSON.stringify(json, null, 2));
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
      const outPath = 'scratch/sol_audits/full_project_enhancement.md';
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
