// sw.js

// IMPORTANT: Manually update this version string when you make changes to sw.js or critical app assets (like index.html)
const SW_VERSION = 'v1.0.3'; // Or increment if you've changed sw.js or index.html significantly
const CACHE_PREFIX = 'webllm-chat-pwa-cache';
const CACHE_NAME = `${CACHE_PREFIX}-${SW_VERSION}`;
const APP_SHELL_URL = './index.html';

const PRECACHE_ASSETS = [
    APP_SHELL_URL
];

self.addEventListener('install', event => {
    console.log(`[SW ${SW_VERSION}] Install event`);
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log(`[SW ${SW_VERSION}] Caching app shell and precache assets:`, PRECACHE_ASSETS);
            const cachePromises = PRECACHE_ASSETS.map(url => {
                return cache.add(new Request(url, { cache: 'reload' })).catch(err => {
                    console.error(`[SW ${SW_VERSION}] Failed to cache ${url} during install:`, err);
                });
            });
            return Promise.all(cachePromises);
        })
        .then(() => {
            console.log(`[SW ${SW_VERSION}] Skip waiting after install`);
            return self.skipWaiting();
        })
        .catch(err => console.error(`[SW ${SW_VERSION}] Installation failed:`, err))
    );
});

self.addEventListener('activate', event => {
    console.log(`[SW ${SW_VERSION}] Activate event`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
                        console.log(`[SW ${SW_VERSION}] Deleting old cache:`, cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW ${SW_VERSION}] Clients claimed`);
            return self.clients.claim();
        })
        .catch(err => console.error(`[SW ${SW_VERSION}] Activation failed:`, err))
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (event.request.mode === 'navigate' &&
        requestUrl.origin === self.location.origin &&
        requestUrl.pathname === new URL(APP_SHELL_URL, self.location.origin).pathname) {
        event.respondWith(
            caches.match(APP_SHELL_URL)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
            .catch(err => {
                console.error(`[SW ${SW_VERSION}] Fetch failed for app shell (${APP_SHELL_URL}):`, err);
                return new Response('<h1>Offline</h1><p>The application cannot be loaded. Please check your internet connection.</p>', {
                    headers: { 'Content-Type': 'text/html' }
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
        .then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(networkResponse => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return networkResponse;
            }).catch(error => {
                console.error(`[SW ${SW_VERSION}] Network fetch error for ${event.request.url}:`, error);
            });
        })
    );
});