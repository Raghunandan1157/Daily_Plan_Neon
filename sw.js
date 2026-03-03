const CACHE_NAME = 'nlpl-v4';
const STATIC_ASSETS = [
    './',
    'index.html',
    'script.min.js',
    'styles.min.css',
    'logo.png'
];

// Install: cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: cache-first for static assets, network-first for API/CDN
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Neon API calls — always go to network (data must be fresh)
    if (url.hostname.includes('neon.tech')) return;

    // Static assets (same origin) — cache-first, update in background
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const networkFetch = fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || networkFetch;
            })
        );
        return;
    }

    // CDN scripts (jsdelivr, cdnjs, sheetjs, google fonts) — cache after first download
    if (url.hostname.includes('jsdelivr') ||
        url.hostname.includes('cdnjs') ||
        url.hostname.includes('sheetjs') ||
        url.hostname.includes('fonts.googleapis') ||
        url.hostname.includes('fonts.gstatic')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
    }
});
