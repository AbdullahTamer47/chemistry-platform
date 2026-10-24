import fs from 'fs';
import { askGptSolStream } from '../scripts/sol_stream_core.js';

async function run() {
  const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

  const prompt = `Here is server/routes/leaderboard.js (56 lines):
\`\`\`javascript
${code}
\`\`\`

Task:
Rewrite this file to:
1. Add a helper function \`getChemistryBadge(totalPoints)\` returning:
   - 1000+: { title: 'نابغة الكيمياء', badge: 'crown', color: '#f59e0b' }
   - 600-999: { title: 'عالم كيمياء', badge: 'flask', color: '#10b981' }
   - 300-599: { title: 'محترف الروابط', badge: 'atom', color: '#06b6d4' }
   - 0-299: { title: 'مستكشف الذرة', badge: 'compass', color: '#6366f1' }
2. Map each student in the leaderboard to include \`badge: getChemistryBadge(student.total_score || (student.avg_score * student.exams_taken))\`.
3. Support optional \`timeframe=monthly\` query parameter: if \`timeframe === 'monthly'\`, add \`AND ea.completed_at >= datetime('now', '-30 days')\`.
4. In \`/my-rank\`, return \`badge: getChemistryBadge(...)\`.

Output the complete, updated JavaScript code directly in a \`\`\`javascript block.`;

  console.log('Sending focused prompt to gpt-6.1-sol...');
  const res = await askGptSolStream(prompt, 'scratch/focused_leaderboard_res.md');
  console.log(`\n🎉 Received response in ${res.elapsed}s!`);
  console.log('Usage:', res.usage);

  const match = res.text.match(/```javascript([\s\S]*?)```/) || res.text.match(/```js([\s\S]*?)```/);
  if (match) {
    fs.writeFileSync('server/routes/leaderboard.js', match[1].trim(), 'utf8');
    console.log('🚀 Successfully updated server/routes/leaderboard.js!');
  }
}

run().catch(console.error);
