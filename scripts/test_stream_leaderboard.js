import fs from 'fs';
import { streamGptSol } from './sol_stream_client.js';

async function testLeaderboardStream() {
  console.log('⚡ Auditing server/routes/leaderboard.js with gpt-6.1-sol in streaming mode...');
  const code = fs.readFileSync('server/routes/leaderboard.js', 'utf8');

  const prompt = `You are a Principal Software Architect reviewing an Egyptian Chemistry Learning Platform (كيمياوي).
Here is the complete code of server/routes/leaderboard.js:
\`\`\`javascript
${code}
\`\`\`

Tasks:
1. Identify any flaws or limitations in the ranking calculation (points, accuracy, streaks).
2. Write an improved replacement implementation with:
   - Rank calculation based on total exam score + streak bonus
   - Chemistry rank titles (مستكشف الذرة -> محترف الروابط -> عالم كيمياء -> عبقري كيمياوي)
   - Proper monthly / all-time filtering
Provide clean, production-ready JavaScript code.`;

  let tokenCount = 0;
  const result = await streamGptSol(prompt, (delta) => {
    tokenCount++;
    process.stdout.write(delta);
  });

  console.log(`\n\n✅ COMPLETED in ${result.elapsedSeconds}s!`);
  console.log('Usage:', JSON.stringify(result.usage));
  fs.writeFileSync('scratch/leaderboard_sol_audit.md', result.text, 'utf8');
}

testLeaderboardStream().catch(console.error);
