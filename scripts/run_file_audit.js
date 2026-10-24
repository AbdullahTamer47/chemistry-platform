import https from 'https';
import fs from 'fs';

const API_KEY = process.env.AGENTROUTER_API_KEY || 'sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh';
const BASE_URL = 'https://agentrouter.org/v1/responses';
const MODEL = 'gpt-6.1-sol';

export async function auditWithRetry({ moduleName, filePath, promptText, outputFile }, maxRetries = 3) {
  console.log(`\n================================================================`);
  console.log(`🔬 [GPT-6.1-SOL] Auditing: ${moduleName}`);
  console.log(`📁 Target File: ${filePath}`);
  console.log(`💾 Output File: ${outputFile}`);
  console.log(`================================================================`);

  const fileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const fullPrompt = `${promptText}\n\n\`\`\`javascript\n${fileContent}\n\`\`\``;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n📡 [Attempt ${attempt}/${maxRetries}] Sending prompt to gpt-6.1-sol...`);
      fs.writeFileSync(outputFile, `# GPT-6.1-SOL AUDIT REPORT: ${moduleName}\n\n`, 'utf8');

      const result = await executeStream(fullPrompt, outputFile);
      console.log(`\n🎉 Success! Wrote ${result.charCount} characters to ${outputFile}`);
      console.log(`⏱️ Elapsed: ${result.elapsed}s | Tokens: ${JSON.stringify(result.usage || {})}`);
      return result;
    } catch (err) {
      console.error(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (err.message.includes('rate_limit') || err.message.includes('too_many_requests') || err.message.includes('429')) {
        console.log(`⏳ Rate limit reached. Waiting 35 seconds before retry...`);
        await new Promise(r => setTimeout(r, 35000));
      } else if (attempt < maxRetries) {
        console.log(`⏳ Waiting 10 seconds before retry...`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        throw err;
      }
    }
  }
}

function executeStream(fullPrompt, outputFile) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: MODEL,
      input: fullPrompt,
      stream: true
    });

    const startTime = Date.now();
    let charCount = 0;
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
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'error') {
              reject(new Error(`Stream Error: ${event.error?.message || JSON.stringify(event.error)}`));
              return;
            }

            if (event.type === 'response.failed') {
              reject(new Error(`Response Failed: ${event.response?.error?.message || JSON.stringify(event.response?.error)}`));
              return;
            }

            if (event.type === 'response.output_text.delta' && event.delta) {
              fs.appendFileSync(outputFile, event.delta, 'utf8');
              charCount += event.delta.length;
              process.stdout.write('.');
            } else if (event.type === 'response.completed') {
              finalUsage = event.response?.usage;
            }
          } catch (e) {
            // ignore non-json SSE lines
          }
        }
      });

      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        resolve({ charCount, elapsed, usage: finalUsage });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
