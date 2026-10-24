import fs from 'fs';
import { queryGptSolFull } from './sol_query.js';

async function main() {
  console.log('================================================================');
  console.log('🔬 AUDITING LEADERBOARD & STUDENT MASTERY ENGINE WITH GPT-6.1-SOL');
  console.log('================================================================');

  const currentCode = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

  const prompt = `You are a Principal Software Architect reviewing an Egyptian Chemistry Educational Platform (كيمياوي - Dr. Ziad Ramzy).

Here is the current implementation of server/routes/leaderboard.js:
\`\`\`javascript
${currentCode}
\`\`\`

Task:
1. Conduct a rigorous code audit:
   - Identify issues with score calculation, ties, and monthly timestamp filtering.
   - Propose an improved, gamified ranking algorithm suitable for high school Thanawya Amma chemistry students.
2. Provide a COMPLETE, DROP-IN REPLACEMENT for server/routes/leaderboard.js that:
   - Implements 4 Chemistry Rank Badges based on total points:
     * 1000+ points: "نابغة الكيمياء" (Chemistry Genius)
     * 600 - 999 points: "عالم كيمياء" (Chemistry Scientist)
     * 300 - 599 points: "محترف الروابط" (Bonding Expert)
     * 0 - 299 points: "مستكشف الذرة" (Atom Explorer)
   - Supports 'all' vs 'monthly' time filters using SQLite compatible dates (datetime('now', '-30 days')).
   - Calculates consecutive exam activity streak.
   - Uses parameterized SQL queries with zero injection risk.
   - Includes tie-breaker logic: score DESC, duration ASC, submitted_at ASC.
   - Returns rank, badge, streak, exams_taken, avg_score, total_score.

Please output your analysis and the complete JavaScript code.`;

  const result = await queryGptSolFull(prompt);

  console.log('\n================================================================');
  console.log(`🎉 Audit Completed Successfully in ${result.elapsed}s!`);
  console.log(`📊 Total Tokens: ${JSON.stringify(result.usage || {})}`);
  console.log('================================================================\n');

  fs.writeFileSync('scratch/gpt_sol_leaderboard_solution.md', result.text, 'utf8');
  console.log('💾 Saved full response to scratch/gpt_sol_leaderboard_solution.md');

  // Extract javascript code block
  const codeMatch = result.text.match(/```javascript([\s\S]*?)```/) || result.text.match(/```js([\s\S]*?)```/);
  if (codeMatch && codeMatch[1]) {
    const newCode = codeMatch[1].trim();
    fs.writeFileSync('server/routes/leaderboard.js', newCode, 'utf8');
    console.log('🚀 Successfully updated server/routes/leaderboard.js with GPT-6.1-SOL generated code!');
  } else {
    console.log('⚠️ Could not automatically extract code block, please review scratch/gpt_sol_leaderboard_solution.md');
  }
}

main().catch(err => {
  console.error('Fatal Audit Error:', err);
  process.exit(1);
});
