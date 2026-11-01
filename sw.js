// বন্ধন - Service Worker
// নতুন সংস্করণ চালু করতে নিচের VERSION বদলান (পুরনো ক্যাশ নিজে থেকে মুছে যাবে)।
const VERSION = "v2";
const CACHE_NAME = `bondhan-${VERSION}`;
const INDEX_URL = "./index.html";
const PRECACHE = [INDEX_URL, "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // কোনো একটি ফাইল না পেলেও ইনস্টল যেন ব্যর্থ না হয়; "reload" দিয়ে সবসময় নতুন কপি আনা হয়
    await Promise.allSettled(
      PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))
    );
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith("bondhan-") && k !== CACHE_NAME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // শুধু একই সাইটের GET অনুরোধ সামলানো হয়।
  // Google Sheets, Apps Script (POST সহ), CDN, ফন্ট ইত্যাদি সরাসরি নেটওয়ার্কে যাবে।
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  const accept = (req.headers && req.headers.get && req.headers.get("accept")) || "";
  const isPage = req.mode === "navigate" || accept.includes("text/html");

  event.respondWith(isPage ? networkFirstPage(req) : staleWhileRevalidate(event, req));
});

// অ্যাপের পেজ: আগে নেটওয়ার্ক (সবসময় নতুন সংস্করণ), ধীর বা অফলাইন হলে ক্যাশ
async function networkFirstPage(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetchWithTimeout(req, NETWORK_TIMEOUT_MS);
    if (fresh && fresh.ok && !fresh.redirected) {
      cache.put(INDEX_URL, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(INDEX_URL);
    if (cached) return cached;
    return fetch(req); // ক্যাশে কিছু নেই: টাইমআউট ছাড়া আবার চেষ্টা
  }
}

// আইকন, ম্যানিফেস্ট ইত্যাদি: ক্যাশ থেকে সাথে সাথে, পেছনে নতুন কপি আপডেট
async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const res = await refresh;
  return res || Response.error();
}

function fetchWithTimeout(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
