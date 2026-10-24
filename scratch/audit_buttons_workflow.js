import http from 'http';
import fs from 'fs';

async function auditPages() {
  console.log('Sending Button-by-Button UI & API Audit request to gpt-6.1-sol via proxy...');

  const prompt = `Review the chemistry platform codebase focusing on every interactive button and workflow in:
1. src/pages/courseDetail.js:
   - Check all action buttons: Enroll button, PDF download buttons, Exam/Quiz launch buttons, Discussion comment/reply/delete buttons, Chemistry Lab modal trigger.
   - Ensure error handling, disabled states during network requests, and proper auth checks.
2. src/pages/wallet.js:
   - Check all buttons: Fawry reference code generation, Center scratch voucher charge, Vodafone Cash / InstaPay manual payment request submission with receipt upload, copy buttons.
3. server/routes/payments.js:
   - Ensure payment request review, instant activation on approval, and notifications.
4. src/pages/live.js:
   - Check live session join, chat send button, teacher session end/start buttons.

For each file:
1. List any discovered bugs, broken selectors, race conditions, or UX flaws.
2. Provide exact, complete, production-ready code replacements or fixes.
Answer in structured format with code blocks.`;

  const payload = JSON.stringify({
    model: 'gpt-6.1-sol',
    messages: [
      { role: 'user', content: prompt }
    ],
    stream: true
  });

  const req = http.request('http://127.0.0.1:4141/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log(`HTTP Status: ${res.statusCode}`);
    let fullText = '';

    res.on('data', chunk => {
      const str = chunk.toString();
      const lines = str.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            process.stdout.write(delta);
            fullText += delta;
          } catch (e) {}
        }
      }
    });

    res.on('end', () => {
      console.log('\n\n--- Finished Receiving Stream ---');
      fs.writeFileSync('scratch/sol_audits/buttons_and_pages_audit.md', fullText, 'utf8');
      console.log('Saved to scratch/sol_audits/buttons_and_pages_audit.md');
    });
  });

  req.on('error', err => {
    console.error('Request error:', err);
  });

  req.write(payload);
  req.end();
}

auditPages();
