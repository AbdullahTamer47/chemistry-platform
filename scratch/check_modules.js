async function trace() {
  const visited = new Set();
  const queue = ['/src/main.js'];
  while (queue.length > 0) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const res = await fetch('http://127.0.0.1:5173' + url);
    if (!res.ok) {
      console.error('FAIL ' + res.status + ' on ' + url);
      process.exit(1);
    }
    const text = await res.text();
    const regex = /from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      let imp = match[1];
      if (imp.startsWith('.')) {
        const base = url.substring(0, url.lastIndexOf('/') + 1);
        const resolved = new URL(imp, 'http://127.0.0.1:5173' + base).pathname;
        queue.push(resolved);
      } else if (imp.startsWith('/')) {
        queue.push(imp);
      }
    }
  }
  console.log('✅ Successfully traced ' + visited.size + ' modules with 0 errors!');
}
trace().catch(console.error);
