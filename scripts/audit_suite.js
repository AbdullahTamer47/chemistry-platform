import { auditWithRetry } from './run_file_audit.js';

async function main() {
  const target = process.argv[2] || 'leaderboard';

  if (target === 'leaderboard') {
    await auditWithRetry({
      moduleName: 'Leaderboard & Gamification Engine',
      filePath: 'server/routes/leaderboard.js',
      promptText: `You are a Principal Software Architect reviewing an Egyptian Chemistry Educational Platform (كيمياوي - Dr. Ziad Ramzy).
Here is the code of server/routes/leaderboard.js.

Tasks:
1. Provide a rigorous review of scoring inaccuracies, tie-breaker flaws, and monthly date filtering.
2. Provide a full, drop-in replacement for server/routes/leaderboard.js that adds:
   - Rank badges:
     * 1000+ pts: "نابغة الكيمياء" (Chemistry Genius)
     * 600-999 pts: "عالم كيمياء" (Chemistry Scientist)
     * 300-599 pts: "محترف الروابط" (Bonding Expert)
     * 0-299 pts: "مستكشف الذرة" (Atom Explorer)
   - Proper monthly & all-time filter with zero SQL injection risk
   - Streak calculation from student exam attempts
   - Anti-tamper sort: score DESC, duration ASC, submitted_at ASC
Write out the clean, complete replacement code.`,
      outputFile: 'scratch/audit_leaderboard_final.md'
    });
  } else if (target === 'exams') {
    await auditWithRetry({
      moduleName: 'Exam Submission & Auto-Grading Engine',
      filePath: 'server/routes/exams.js',
      promptText: `You are a Principal Software Architect reviewing server/routes/exams.js for an Egyptian Thanawya Amma Chemistry Platform.

Tasks:
1. Analyze exam submission integrity: prevent client-side time manipulation, enforce max attempts, secure essay submissions, and validate answers against server key.
2. Provide concrete code enhancements for server/routes/exams.js to:
   - Validate submission timestamps against exam start time on the server to prevent timer freezes.
   - Return structured feedback (chemistry explanation) for each question upon exam completion.
Provide code snippets and improvements.`,
      outputFile: 'scratch/audit_exams_final.md'
    });
  }
}

main().catch(console.error);
