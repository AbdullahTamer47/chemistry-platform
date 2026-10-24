import fs from 'fs';

const logPath = 'C:/Users/Abdullah_Yassen/.gemini/antigravity-ide/brain/8493d843-f6d5-409c-b601-dea7a4a89e10/.system_generated/tasks/task-5037.log';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  console.log('Log file size:', content.length, 'bytes');

  // Find all text fragments
  const matchDeltas = [];
  const regex = /"delta":"([^"]+)"/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    try {
      matchDeltas.push(JSON.parse(`"${m[1]}"`));
    } catch {
      matchDeltas.push(m[1]);
    }
  }

  console.log('Found delta fragments:', matchDeltas.length);
  const reassembled = matchDeltas.join('');
  console.log('Reassembled length:', reassembled.length);
  if (reassembled.length > 0) {
    fs.writeFileSync('scratch/extracted_sol_leaderboard.md', reassembled, 'utf8');
    console.log('Saved to scratch/extracted_sol_leaderboard.md');
    console.log('\nPreview:\n', reassembled.slice(0, 500));
  }
} else {
  console.log('Log file not found');
}
