// Bondhan service worker (v12)
// Google Sheets / Apps Script ডেটা কখনো ক্যাশ হবে না; বাকি ফাইল network-first, অফলাইনে ক্যাশ থেকে।
const CACHE = 'bondhan-v12';
const NEVER_CACHE_HOSTS = [
  'docs.google.com',
  'script.google.com',
  'script.googleusercontent.com',
  'forms.gle'
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (NEVER_CACHE_HOSTS.includes(url.hostname)) return; // সরাসরি নেটওয়ার্কে যাবে

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
        }
        return Response.error();
      })
  );
});
