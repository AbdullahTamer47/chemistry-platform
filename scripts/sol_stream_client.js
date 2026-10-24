import https from 'https';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

/**
 * Robust streaming query to gpt-6.1-sol via AgentRouter /v1/responses
 */
export async function streamGptSol(prompt, onToken = null) {
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
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'response.output_text.delta' && event.delta) {
              accumulatedText += event.delta;
              if (onToken) onToken(event.delta);
            } else if (event.type === 'response.completed') {
              finalUsage = event.response?.usage || null;
            }
          } catch (e) {
            // ignore non-json SSE lines
          }
        }
      });

      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        resolve({
          text: accumulatedText,
          usage: finalUsage,
          elapsedSeconds: parseFloat(elapsed)
        });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
