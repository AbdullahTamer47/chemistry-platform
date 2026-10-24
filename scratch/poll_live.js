async function poll() {
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch('https://chemistry-platform-two.vercel.app/', { cache: 'no-store' });
      const t = await r.text();
      const m = t.match(/assets\/index-[^"']+\.js/g);
      const lm = r.headers.get('last-modified');
      console.log(`[Attempt ${i + 1}] Asset: ${m ? m[0] : 'None'} | Last-Modified: ${lm}`);
      if (m && m[0].includes('DsYb2Fni')) {
        console.log('🎉 GPT-6.1-SOL FIX DEPLOYED TO VERCEL SUCCESSFULLY!');
        return;
      }
    } catch (e) {
      console.error(e.message);
    }
    await new Promise(res => setTimeout(res, 5000));
  }
}

poll();
