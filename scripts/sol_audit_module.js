import https from 'https';
import fs from 'fs';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

/**
 * Executes a streaming prompt to gpt-6.1-sol, assembles the full output,
 * logs progress, and saves the result to an output file.
 */
export async function auditFileWithSol({ moduleName, filePath, promptText, outputReportPath }) {
  console.log(`\n================================================================`);
  console.log(`🔬 [GPT-6.1-SOL] Starting Stream Audit for: ${moduleName}`);
  console.log(`📁 Source: ${filePath || 'N/A'}`);
  console.log(`================================================================`);

  const fileContent = filePath ? fs.readFileSync(filePath, 'utf8') : '';
  const fullPrompt = `${promptText}\n\n\`\`\`javascript\n${fileContent}\n\`\`\``;

  const payload = JSON.stringify({
    model: MODEL,
    input: fullPrompt,
    stream: true
  });

  console.log(`📡 Sending request (Payload: ${Buffer.byteLength(payload)} bytes)...`);
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    let accumulatedText = '';
    let finalUsage = null;
    let reasoningCount = 0;
    let textChunkCount = 0;

    const req = https.request(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'opencode/1.0',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      console.log(`🔌 Connected to agentrouter.org (HTTP ${res.statusCode})`);
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', c => errBody += c);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody}`)));
        return;
      }

      let buffer = '';

      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'response.output_item.added' && event.item?.type === 'reasoning') {
              reasoningCount++;
              process.stdout.write(`🧠 [Reasoning Step ${reasoningCount}] `);
            } else if (event.type === 'response.output_text.delta' && event.delta) {
              accumulatedText += event.delta;
              textChunkCount++;
              if (textChunkCount % 40 === 0) {
                process.stdout.write('.');
              }
            } else if (event.type === 'response.completed') {
              finalUsage = event.response?.usage;
              // Also ensure we didn't miss text in completed object
              const msg = event.response?.output?.find(o => o.type === 'message');
              const fullText = msg?.content?.find(c => c.type === 'output_text')?.text;
              if (fullText && fullText.length > accumulatedText.length) {
                accumulatedText = fullText;
              }
            }
          } catch (e) {
            // ignore non-json SSE lines
          }
        }
      });

      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n\n🎉 [GPT-6.1-SOL] Completed in ${elapsed}s!`);
        console.log(`📊 Output length: ${accumulatedText.length} characters`);
        console.log(`💰 Token Usage:`, JSON.stringify(finalUsage || {}));

        if (outputReportPath) {
          fs.writeFileSync(outputReportPath, accumulatedText, 'utf8');
          console.log(`💾 Saved audit report to: ${outputReportPath}`);
        }

        resolve({
          text: accumulatedText,
          usage: finalUsage,
          elapsedSeconds: parseFloat(elapsed)
        });
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Request error:`, err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}
