// sw.js

// IMPORTANT: Manually update this version string when you make changes to sw.js or critical app assets (like index.html)
// This will trigger the 'install' event for the new service worker and clear out old caches during 'activate'.
const SW_VERSION = 'v1.0.3'; // Example: Increment to v1.0.3 if you change something
const CACHE_PREFIX = 'webllm-chat-pwa-cache';
const CACHE_NAME = `${CACHE_PREFIX}-${SW_VERSION}`;

// This is the main HTML file of your PWA.
// It's crucial for GitHub Pages that this path is correct relative to where the SW is served.
// If index.html and sw.js are in the root of your gh-pages branch, './index.html' is correct.
const APP_SHELL_URL = './index.html';

// List of URLs to pre-cache during the SW 'install' event.
// For a single-page app, the main HTML file is the most important.
// Other static assets like a logo or critical CSS could be added here if they weren't inline.
const PRECACHE_ASSETS = [
    APP_SHELL_URL
];

self.addEventListener('install', event => {
    console.log(`[SW ${SW_VERSION}] Install event`);
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log(`[SW ${SW_VERSION}] Caching app shell and precache assets:`, PRECACHE_ASSETS);
            // Use { cache: 'reload' } to ensure we fetch the latest version of index.html
            // from the network during SW install. This is important if index.html itself has changed.
            const cachePromises = PRECACHE_ASSETS.map(url => {
                return cache.add(new Request(url, { cache: 'reload' })).catch(err => {
                    console.error(`[SW ${SW_VERSION}] Failed to cache ${url} during install:`, err);
                });
            });
            return Promise.all(cachePromises);
        })
        .then(() => {
            console.log(`[SW ${SW_VERSION}] Skip waiting after install`);
            return self.skipWaiting(); // Force the new SW to become active immediately
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
                    // Delete old caches that don't match the current CACHE_NAME
                    // and belong to this PWA (based on CACHE_PREFIX)
                    if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) {
                        console.log(`[SW ${SW_VERSION}] Deleting old cache:`, cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW ${SW_VERSION}] Clients claimed`);
            return self.clients.claim(); // Take control of all open PWA pages
        })
        .catch(err => console.error(`[SW ${SW_VERSION}] Activation failed:`, err))
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // 1. Handle navigation requests (for the main app shell, index.html)
    //    This ensures the PWA loads from cache when offline or for faster startups.
    if (event.request.mode === 'navigate' &&
        requestUrl.origin === self.location.origin && // Only handle requests for own origin
        requestUrl.pathname === new URL(APP_SHELL_URL, self.location.origin).pathname) {
        event.respondWith(
            caches.match(APP_SHELL_URL)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // console.log(`[SW ${SW_VERSION}] Serving app shell from cache: ${APP_SHELL_URL}`);
                    return cachedResponse;
                }
                // console.log(`[SW ${SW_VERSION}] App shell not in cache, fetching from network: ${APP_SHELL_URL}`);
                // Fallback to network if not in cache (should be rare after install)
                return fetch(event.request);
            })
            .catch(err => {
                console.error(`[SW ${SW_VERSION}] Fetch failed for app shell (${APP_SHELL_URL}):`, err);
                // Provide a basic offline fallback page if the app shell can't be loaded.
                return new Response('<h1>Offline</h1><p>The application cannot be loaded. Please check your internet connection.</p>', {
                    headers: { 'Content-Type': 'text/html' }
                });
            })
        );
        return; // Important to return after handling navigation
    }

    // 2. Handle other requests (e.g., esm.run, images, APIs)
    //    Strategy: Cache first, then network. Cache successful network responses.
    event.respondWith(
        caches.match(event.request)
        .then(cachedResponse => {
            if (cachedResponse) {
                // console.log(`[SW ${SW_VERSION}] Serving from cache: ${event.request.url}`);
                return cachedResponse;
            }

            // console.log(`[SW ${SW_VERSION}] Not in cache, fetching from network: ${event.request.url}`);
            return fetch(event.request).then(networkResponse => {
                // Check if we received a valid response before caching
                // For 'opaque' responses (e.g. from no-cors CDNs), we can't check status, but can still cache.
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            // console.log(`[SW ${SW_VERSION}] Caching new resource: ${event.request.url}`);
                            cache.put(event.request, responseToCache);
                        });
                } else if (networkResponse) { // Log non-200 responses if not opaque
                    // console.warn(`[SW ${SW_VERSION}] Did not cache non-200 response for ${event.request.url}: Status ${networkResponse.status}`);
                }
                return networkResponse;
            }).catch(error => {
                console.error(`[SW ${SW_VERSION}] Network fetch error for ${event.request.url}:`, error);
                // For non-navigation requests, failing usually means the resource is unavailable.
                // You might return a placeholder for images, or just let the browser error propagate.
                // Throwing an error here will result in a browser network error for the resource.
                // return new Response(`Network error for ${event.request.url}`, {status: 408, statusText: "Network request failed"});
            });
        })
    );
});
