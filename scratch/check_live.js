async function check() {
  try {
    const r = await fetch('https://chemistry-platform-two.vercel.app/', { cache: 'no-store' });
    const t = await r.text();
    const m = t.match(/assets\/index-[^"']+\.js/g);
    console.log('Live asset:', m ? m[0] : 'None');
    console.log('Status:', r.status);
    console.log('Last-Modified:', r.headers.get('last-modified'));
    console.log('Date:', r.headers.get('date'));
    console.log('x-vercel-id:', r.headers.get('x-vercel-id'));

    // Also check api/health
    const h = await fetch('https://chemistry-platform-two.vercel.app/api/health', { cache: 'no-store' });
    console.log('API Health Status:', h.status);
    console.log('API Content-Type:', h.headers.get('content-type'));
    const ht = await h.text();
    console.log('API snippet:', ht.slice(0, 100));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
check();
