import fs from 'fs';
import { askGptSolStream } from '../scripts/sol_stream_core.js';

async function main() {
  console.log('🔬 Asking GPT-6.1-SOL to review and enhance Exam Submission & Chemistry Feedback...');

  const prompt = `You are a Principal Software Architect reviewing an Egyptian High School Chemistry Platform (كيمياوي).
Here is the core exam submission logic from server/routes/exams.js:

\`\`\`javascript
router.post('/:id/submit', authMiddleware, (req, res) => {
  const { answers, time_spent } = req.body;
  // ... verifies attempt limits, session questions, calculates earnedPoints & results ...
  // returns { attempt_id, score, earned_points, total_points, results, rank, passed, ... }
});
\`\`\`

Task:
1. Design an automated Chemistry Pedagogical Feedback enhancement:
   For every question in \`results\`, when \`is_correct === false\`, generate or enrich:
   - \`concept_reinforcement\`: A targeted advice for Thanawya Amma chemistry students.
   - \`learning_action\`: Recommended review action (e.g. "راجع معادلات أكسدة الحديد" or "أعد حساب عدد مولات المادة المحددة للتفاعل").
2. Add server-side anti-speed-tamper check:
   If an exam has >= 10 questions and \`serverTimeSpent < 15\` seconds, flag as \`speed_warning: true\` and cap score or log warning.

Provide the exact replacement code for the \`results.map\` calculation and submission response block in a \`\`\`javascript ... \`\`\` block.`;

  const res = await askGptSolStream(prompt, 'scratch/sol_audits/02_exams_engine_enhancement.md');
  console.log(`\n🎉 Success! GPT-6.1-SOL responded in ${res.elapsed}s!`);
  console.log('Usage:', res.usage);
}

main().catch(console.error);
