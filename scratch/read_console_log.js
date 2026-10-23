import fs from 'fs';

const text = fs.readFileSync('C:/Users/Abdullah_Yassen/.gemini/antigravity-ide/brain/8493d843-f6d5-409c-b601-dea7a4a89e10/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = text.split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('SyntaxError: Invalid or unexpected token')) {
    console.log('--- FOUND SYNTAX ERROR ---');
    console.log(lines[i].slice(0, 1500));
    break;
  }
}
