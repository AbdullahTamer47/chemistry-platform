import fs from 'fs';
import path from 'path';

const text = `c:\\Users\\Abdullah_Yassen\\Desktop\\chemistry-platform\\serverc:\\Users\\Abdullah_Yassen\\Desktop\\chemistry-platform\\src@server/routes/exams.js @src/pages/exams.js
قم بمراجعة نظام الامتحانات والتصحيح بالكامل في الملفين المرفقين، واكتب الكود المصحح والمطور كاملاً. @server/routes/courses.js @server/routes/lessons.js @src/pages/courseDetail.js
@server/routes/auth.js @server/middleware/auth.js @src/pages/auth.js`;

function extractFilesFromPrompt(promptText) {
  const matches = promptText.matchAll(/[@\s"']([a-zA-Z0-9_\-\./\\]+\.(?:js|json|html|css|md))/g);
  const detected = new Set();

  for (const m of matches) {
    let rawPath = m[1].replace(/^@/, '').trim().replace(/\\/g, '/');
    if (rawPath.includes('chemistry-platform/')) {
      rawPath = rawPath.split('chemistry-platform/')[1];
    }
    if (fs.existsSync(rawPath) && fs.statSync(rawPath).isFile()) {
      detected.add(rawPath);
    }
  }

  return Array.from(detected);
}

const files = extractFilesFromPrompt(text);
console.log('Detected existing files:', files);
