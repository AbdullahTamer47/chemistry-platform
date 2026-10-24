import { auditFileWithSol } from '../scripts/sol_audit_module.js';

async function main() {
  await auditFileWithSol({
    moduleName: 'Student Leaderboard & Ranking System',
    filePath: 'server/routes/leaderboard.js',
    promptText: `You are a Principal Software Architect reviewing an Egyptian Chemistry Educational Platform (كيمياوي).
Tasks:
1. Identify any bugs, performance issues, or edge cases in points calculation, tie-breaking, or attempt tracking.
2. Provide a modernized, production-ready replacement for server/routes/leaderboard.js featuring:
   - Rank badges (مستكشف الذرة -> محترف الروابط -> عالم كيمياء -> عبقري كيمياوي)
   - Monthly and All-time filtering with SQLite compatibility
   - Consecutive active streak calculation
Provide your complete analysis and the full replacement code block.`,
    outputReportPath: 'scratch/leaderboard_sol_complete.md'
  });
}

main().catch(console.error);
