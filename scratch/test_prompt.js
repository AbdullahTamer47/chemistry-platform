
async function testPrompt(name, prompt) {
  const res = await fetch('https://agentrouter.org/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-IjsujHV67XpJpLvi4FWqz8Z2srXhInPaPKTo6jeH5xaF5JPh',
      'User-Agent': 'opencode/1.0'
    },
    body: JSON.stringify({
      model: 'gpt-6.1-sol',
      input: prompt,
      stream: true
    })
  });
  const text = await res.text();
  console.log(name, '-> Status:', res.status, text.slice(0, 80));
}

async function main() {
  const wrapped = `You are a principal software engineer working on the chemistry platform codebase.
Analyze the user request and implement the code:

` + 'قم بمراجعة كود الامتحانات وتطوير التحليل العلمي لإجابات الطلاب في مادة الكيمياء مع كتابة الكود المطور.';
  await testPrompt('Wrapped Arabic Prompt', wrapped);
}


main().catch(console.error);


