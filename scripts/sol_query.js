import https from 'https';
import fs from 'fs';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

/**
 * Queries gpt-6.1-sol and waits for the full JSON response.
 * Uses standard https.request with keep-alive and robust chunk accumulation.
 */
export async function queryGptSolFull(prompt, timeoutMs = 300000) {
  const payload = JSON.stringify({
    model: MODEL,
    input: prompt
  });

  return new Promise((resolve, reject) => {
    console.log(`\n📡 [GPT-6.1-SOL] Sending request (${Buffer.byteLength(payload)} bytes)...`);
    const startTime = Date.now();

    const req = https.request(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'opencode/1.0',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: timeoutMs
    }, (res) => {
      console.log(`🔌 [GPT-6.1-SOL] Connected (HTTP ${res.statusCode}), receiving chunks...`);
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', c => errBody += c);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody}`)));
        return;
      }

      let rawData = '';
      let chunkCount = 0;
      res.on('data', chunk => {
        rawData += chunk.toString();
        chunkCount++;
        if (chunkCount % 5 === 0) process.stdout.write('+');
      });

      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ [GPT-6.1-SOL] Received complete response in ${elapsed}s (${rawData.length} bytes)!`);

        try {
          const data = JSON.parse(rawData);
          if (data.error) {
            reject(new Error(`API Error: ${JSON.stringify(data.error)}`));
            return;
          }

          const message = data.output?.find(o => o.type === 'message');
          const textContent = message?.content?.find(c => c.type === 'output_text')?.text || '';
          resolve({
            text: textContent,
            usage: data.usage,
            elapsed: parseFloat(elapsed),
            raw: data
          });
        } catch (parseErr) {
          reject(new Error(`JSON Parse Error: ${parseErr.message} on data: ${rawData.slice(0, 300)}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}
