#!/usr/bin/env node

/**
 * =========================================================================
 * OpenCode <-> AgentRouter Adapter Proxy
 * Bridges OpenCode (@ai-sdk/openai-compatible /chat/completions)
 * with AgentRouter's OpenAI Responses API (/v1/responses)
 * =========================================================================
 */

import http from 'http';

const PORT = 4141;
const AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const TARGET_URL = 'https://agentrouter.org/v1/responses';

const server = http.createServer(async (req, res) => {
  // CORS Headers
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

        // Build single input prompt from messages
        let promptText = '';
        for (const m of messages) {
          const role = m.role || 'user';
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          promptText += `[${role.toUpperCase()}]:\n${content}\n\n`;
        }

        const isStream = !!body.stream;

        // Call AgentRouter /v1/responses
        const response = await fetch(TARGET_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.authorization || `Bearer ${AGENTROUTER_API_KEY}`,
            'User-Agent': 'opencode/1.0'
          },
          body: JSON.stringify({
            model: 'gpt-6.1-sol',
            input: promptText.trim()
          })
        });

        const data = await response.json();
        if (data.error) {
          res.writeHead(response.status || 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: data.error }));
          return;
        }

        const msg = data.output?.find(o => o.type === 'message');
        const textContent = msg?.content?.find(c => c.type === 'output_text')?.text || '';

        const completionId = data.id || `chatcmpl-${Date.now()}`;

        if (isStream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          // SSE format for @ai-sdk / OpenCode
          const chunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-6.1-sol',
            choices: [
              {
                index: 0,
                delta: { content: textContent },
                finish_reason: null
              }
            ]
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);

          const doneChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-6.1-sol',
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop'
              }
            ]
          };
          res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: completionId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-6.1-sol',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: textContent
                },
                finish_reason: 'stop'
              }
            ],
            usage: data.usage || {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30
            }
          }));
        }
      } catch (err) {
        console.error('[Proxy Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  // Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 OpenCode <-> AgentRouter Proxy running at http://127.0.0.1:${PORT}/v1`);
});
