#!/usr/bin/env node

/**
 * =========================================================================
 * OpenCode <-> AgentRouter Real-Time Streaming Adapter Proxy
 * Bridges OpenCode (@ai-sdk /chat/completions)
 * with AgentRouter's OpenAI Responses API (/v1/responses) using live SSE
 * =========================================================================
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

function extractAndEmbedFiles(promptText) {
  const rootDir = process.cwd();
  const detected = new Set();

  function isSafeRelPath(p) {
    if (!p || typeof p !== 'string') return false;
    if (p.includes('..') || p.includes('$') || p.includes(':')) return false;
    const resolved = path.resolve(rootDir, p);
    return resolved.startsWith(rootDir);
  }

  // 1. Check for single file mentions (.js, .json, .html, .css, .md)
  const matches = promptText.matchAll(/[@\s"']([a-zA-Z0-9_\-\./\\]+\.(?:js|json|html|css|md))/g);
  for (const m of matches) {
    let rawPath = m[1].replace(/^@/, '').trim().replace(/\\/g, '/');
    if (rawPath.includes('chemistry-platform/')) {
      rawPath = rawPath.split('chemistry-platform/')[1];
    }
    if (isSafeRelPath(rawPath)) {
      try {
        const full = path.join(rootDir, rawPath);
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          detected.add(rawPath);
        }
      } catch (e) {}
    }
  }

  // 2. Check for explicit folder mentions like @server or @src (strictly inside rootDir)
  const allowedFolders = ['server', 'src', 'api'];
  for (const f of allowedFolders) {
    const folderRegex = new RegExp(`@${f}\\b|\\b${f}/(?:\\*|all)\\b`, 'i');
    if (folderRegex.test(promptText)) {
      try {
        const fullDir = path.join(rootDir, f);
        if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
          function walkDir(dir, relPrefix) {
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullEntry = path.join(dir, entry.name);
                const relEntry = path.join(relPrefix, entry.name).replace(/\\/g, '/');
                if (entry.isDirectory()) {
                  if (!['node_modules', 'dist', 'backups', '.git', 'uploads', 'tempmediaStorage', '.system_generated'].includes(entry.name)) {
                    walkDir(fullEntry, relEntry);
                  }
                } else if (/\.(js|json|css|html)$/.test(entry.name) && !entry.name.endsWith('.min.js')) {
                  detected.add(relEntry);
                }
              }
            } catch (e) {}
          }
          walkDir(fullDir, f);
        }
      } catch (e) {}
    }
  }

  // If user asked to review project broadly or no files matched, attach core routes
  if (detected.size === 0 && (promptText.includes('مشروع') || promptText.includes('project') || promptText.includes('كود') || promptText.includes('صلح'))) {
    ['server/routes/exams.js', 'server/routes/courses.js', 'server/routes/leaderboard.js', 'server/routes/auth.js', 'server/middleware/auth.js'].forEach(f => {
      if (fs.existsSync(f)) detected.add(f);
    });
  }

  if (detected.size === 0) return '';

  let filesContext = '\n--- ATTACHED REAL PROJECT FILES FROM DISK ---\n';
  for (const filePath of detected) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      filesContext += `\n================================================================================\n`;
      filesContext += `FILE: ${filePath}\n`;
      filesContext += `================================================================================\n`;
      filesContext += `\`\`\`${filePath.endsWith('.json') ? 'json' : filePath.endsWith('.css') ? 'css' : 'javascript'}\n`;
      filesContext += `${content}\n`;
      filesContext += `\`\`\`\n\n`;
    } catch (e) {
      console.error(`Failed to read file ${filePath}:`, e.message);
    }
  }
  return filesContext;
}

const PORT = 4141;
const AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const TARGET_URL = 'https://agentrouter.org/v1/responses';

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

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Models endpoint
  if (req.url === '/v1/models' || req.url === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [
        {
          id: 'gpt-6.1-sol',
          object: 'model',
          created: 1677610602,
          owned_by: 'agentrouter'
        }
      ]
    }));
    return;
  }

  // 2. Chat Completions endpoint
  if (req.url?.includes('/chat/completions')) {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyData || '{}');
        const messages = body.messages || [];

        const SYSTEM_HEADER = `You are a principal software engineer and expert web architect auditing and developing the educational chemistry platform codebase ("كيمياوي").\nAnalyze the user instructions and files, fix bugs, implement features, and produce complete, production-ready code.\n\n`;
        let promptText = SYSTEM_HEADER;
        for (const m of messages) {
          const role = m.role || 'user';
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          promptText += `[${role.toUpperCase()}]:\n${content}\n\n`;
        }

        const embeddedFiles = extractAndEmbedFiles(promptText);
        if (embeddedFiles) {
          promptText += `\n${embeddedFiles}\n\nINSTRUCTION: The actual files from the user's workspace are provided above. Review them line-by-line, fix all identified bugs, implement requested improvements, and output the complete updated code files.`;
        }

        const isStream = !!body.stream;
        const completionId = `chatcmpl-${Date.now()}`;

        const payload = JSON.stringify({
          model: 'gpt-6.1-sol',
          input: promptText.trim(),
          stream: true
        });

        console.log(`[Proxy] Forwarding to AgentRouter (${Buffer.byteLength(payload)}b, stream=${isStream}, attachedFiles=${embeddedFiles ? 'YES' : 'NO'})...`);

        let streamAccumulated = '';
        let nonStreamAccumulated = '';
        let nonStreamUsage = null;
        let sseBuffer = '';

        const agentReq = https.request(TARGET_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || `Bearer ${AGENTROUTER_API_KEY}`,
            'User-Agent': 'opencode/1.0',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (agentRes) => {
          if (agentRes.statusCode !== 200) {
            let errBody = '';
            agentRes.on('data', c => errBody += c);
            agentRes.on('end', () => {
              console.error('[Proxy AgentRouter Error]:', agentRes.statusCode, errBody);
              if (isStream) {
                if (!res.headersSent) {
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                  });
                }
                let errDisplay = `⚠️ خطأ من مزود الذكاء الاصطناعي (${agentRes.statusCode}): ${errBody}`;
                if (errBody.includes('content-blocked')) {
                  errDisplay = `⚠️ تنبيه من مزود الذكاء الاصطناعي (content-blocked): تم حظر النص بسبب كلمات غير مسموحة في فلتر الأمان. يرجى توجيه الأمر بصيغة تقنية برمجية.`;
                }
                const chunkData = {
                  id: completionId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: 'gpt-6.1-sol',
                  choices: [{ index: 0, delta: { content: errDisplay }, finish_reason: 'stop' }]
                };
                res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                if (!res.headersSent) {
                  res.writeHead(agentRes.statusCode, { 'Content-Type': 'application/json' });
                  res.end(errBody);
                } else {
                  res.end();
                }
              }
            });
            return;
          }

          if (isStream && !res.headersSent) {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            });
          }

          agentRes.on('data', chunk => {
            sseBuffer += chunk.toString();
            const { events, remaining } = parseSSE(sseBuffer);
            sseBuffer = remaining;

            for (const ev of events) {
              if (ev.dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(ev.dataStr);
                if (json.type === 'response.output_text.delta' && json.delta) {
                  streamAccumulated += json.delta;
                  if (isStream) {
                    const chunkData = {
                      id: completionId,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'gpt-6.1-sol',
                      choices: [{ index: 0, delta: { content: json.delta }, finish_reason: null }]
                    };
                    res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
                  } else {
                    nonStreamAccumulated += json.delta;
                  }
                } else if (json.type === 'response.completed') {
                  nonStreamUsage = json.response?.usage;
                }
              } catch (e) {}
            }
          });

          agentRes.on('end', () => {
            const finalOutput = streamAccumulated || nonStreamAccumulated;
            if (finalOutput) {
              try {
                fs.mkdirSync('scratch/sol_audits', { recursive: true });
                fs.writeFileSync('scratch/sol_audits/latest_opencode_response.md', finalOutput, 'utf8');
                console.log(`[Proxy] Saved response (${finalOutput.length} chars) to scratch/sol_audits/latest_opencode_response.md`);
              } catch (err) {
                console.error('[Proxy Save Error]:', err.message);
              }
            }
            if (isStream) {
              const doneChunk = {
                id: completionId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: 'gpt-6.1-sol',
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
              };
              res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
              console.log('[Proxy] Stream completed successfully.');
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                id: completionId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gpt-6.1-sol',
                choices: [{
                  index: 0,
                  message: { role: 'assistant', content: nonStreamAccumulated },
                  finish_reason: 'stop'
                }],
                usage: nonStreamUsage || { prompt_tokens: 10, completion_tokens: 100, total_tokens: 110 }
              }));
              console.log('[Proxy] Non-stream completed successfully.');
            }
          });
        });

        agentReq.on('error', (err) => {
          console.error('[Proxy Request Error]:', err.message);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: err.message } }));
          } else {
            res.end();
          }
        });

        agentReq.write(payload);
        agentReq.end();

      } catch (err) {
        console.error('[Proxy Handler Error]:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      }
    });
    return;
  }

  // Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 OpenCode Streaming Proxy running at http://127.0.0.1:${PORT}/v1`);
});
