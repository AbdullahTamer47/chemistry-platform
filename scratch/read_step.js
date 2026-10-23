import fs from 'fs';

const text = fs.readFileSync('C:/Users/Abdullah_Yassen/.gemini/antigravity-ide/brain/8493d843-f6d5-409c-b601-dea7a4a89e10/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = text.trim().split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('capture_browser_console_logs') && lines[i].includes('B1AC63A00E3B8DC18372F16B0C9159EC')) {
    console.log('--- CALL ---');
    console.log(lines[i]);
    console.log('--- NEXT LINE ---');
    console.log(lines[i+1]);
  }
}
