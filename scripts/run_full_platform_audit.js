import fs from 'fs';
import path from 'path';
import { askGptSolStream } from './sol_stream_core.js';

const AUDIT_DIR = 'scratch/sol_audits';
if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

async function auditModule(moduleName, filePath, specificPrompt, outputReportPath) {
  console.log('\n================================================================');
  console.log(`🔬 [GPT-6.1-SOL] بدء مراجعة وتطوير: ${moduleName}`);
  console.log(`📁 الملف المستهدف: ${filePath}`);
  console.log(`💾 ملف التقرير: ${outputReportPath}`);
  console.log('================================================================\n');

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const fullPrompt = `You are a Principal Software Architect and elite Senior Full-Stack Engineer.
Conduct a deep, production-level code review and enhancement of an Egyptian Thanawya Amma Chemistry Learning Platform ("كيمياوي" - Dr. Ziad Ramzy).

Target File: ${filePath}
Source Code:
\`\`\`javascript
${fileContent}
\`\`\`

Detailed Requirements for this module:
${specificPrompt}

Instructions:
1. Provide a comprehensive architecture and security audit explaining any vulnerabilities, edge cases, or performance bottlenecks.
2. Provide the COMPLETE, PRODUCTION-READY replacement or enhancement JavaScript code. Do not use placeholders or omit lines.
3. Keep the code compatible with Node.js Express and SQLite (better-sqlite3 / sql.js).
Answer thoroughly in Arabic or English with complete code blocks.`;

  fs.writeFileSync(outputReportPath, `# تقرير مراجعة وتطوير ${moduleName} بواسطة GPT-6.1-SOL\n\n`, 'utf8');

  try {
    const result = await askGptSolStream(fullPrompt, outputReportPath);
    const elapsedMinutes = (result.elapsed / 60).toFixed(1);

    console.log('\n================================================================');
    console.log(`🎉 تم الانتهاء بنجاح من: ${moduleName}`);
    console.log(`⏱️ استغرق التفكير والكتابة: ${result.elapsed} ثانية (~${elapsedMinutes} دقيقة)`);
    console.log(`📊 استهلاك التوكنز: ${JSON.stringify(result.usage || {})}`);
    console.log(`💾 التقرير والكود الكامل محفوظ في: ${outputReportPath}`);
    console.log('================================================================\n');

    return { text: result.text, usage: result.usage };
  } catch (err) {
    console.error(`❌ خطأ أثناء معالجة ${moduleName}:`, err.message);
    throw err;
  }
}

async function main() {
  const stage = process.argv[2] || 'leaderboard';

  // -------------------------------------------------------------
  // STAGE 1: LEADERBOARD & STUDENT CHEMISTRY MASTERY LEVELS
  // -------------------------------------------------------------
  if (stage === 'all' || stage === 'leaderboard') {
    const leaderboardPrompt = `
Tasks for server/routes/leaderboard.js:
1. Audit ranking calculation, score aggregation, ties, and monthly date filtering.
2. Rewrite server/routes/leaderboard.js completely to include:
   - 4 Chemistry Mastery Badges:
     * 1000+ points: "نابغة الكيمياء" (Chemistry Genius)
     * 600 - 999 points: "عالم كيمياء" (Chemistry Scientist)
     * 300 - 599 points: "محترف الروابط" (Bonding Expert)
     * 0 - 299 points: "مستكشف الذرة" (Atom Explorer)
   - Consecutive active streak calculation from exam attempts.
   - Robust monthly ('monthly') vs all-time ('all') filters using SQLite compatible syntax.
   - Clean tie-breaking (highest score -> fastest time -> earliest submission).
   - Anti-tamper input validation.
Output the full JavaScript code in a \`\`\`javascript ... \`\`\` block.`;

    const res = await auditModule(
      'نظام لوحة الشرف والرتب الكيميائية (Leaderboard)',
      'server/routes/leaderboard.js',
      leaderboardPrompt,
      path.join(AUDIT_DIR, '01_leaderboard_enhancement.md')
    );

    // Apply code if present
    const codeMatch = res.text.match(/```javascript([\s\S]*?)```/) || res.text.match(/```js([\s\S]*?)```/);
    if (codeMatch && codeMatch[1] && codeMatch[1].includes('express')) {
      fs.writeFileSync('server/routes/leaderboard.js', codeMatch[1].trim(), 'utf8');
      console.log('🚀 تم تطبيق الكود المطور لـ server/routes/leaderboard.js بنجاح!');
    }
  }
}

main().catch(err => {
  console.error('Fatal Audit Suite Error:', err);
  process.exit(1);
});
