const CACHE = 'pulse-v3'

// During development, avoid caching "/" and "/index.html"
// because they can keep serving old Supabase config.
const ASSETS = ['/manifest.json']

// ── install: cache core files ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  )

  // Activate the new service worker immediately
  self.skipWaiting()
})

// ── activate: clean old caches ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  )

  // Take control of open pages immediately
  self.clients.claim()
})

// ── fetch: network-first for pages, cache-first for static assets ─────────
self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)

  // Only handle GET requests
  if (req.method !== 'GET') return

  // Ignore browser-extension and other non-http(s) requests.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // Only cache this app's own assets and page requests.
  if (url.origin !== self.location.origin) return

  // Do not cache Supabase/API/WebSocket-related requests
  if (
    url.href.includes('supabase.co') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/realtime/v1') ||
    url.pathname.includes('/functions/v1')
  ) {
    e.respondWith(fetch(req))
    return
  }

  // For app page loads, use network first so updated HTML/JS loads
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put(req, copy))
          return res
        })
        .catch(() => caches.match(req))
    )
    return
  }

  // For static assets, cache first, then network
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached

      return fetch(req).then(res => {
        // Only cache successful basic same-origin responses
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res
        }

        const copy = res.clone()
        caches.open(CACHE).then(cache => cache.put(req, copy))
        return res
      })
    })
  )
})

// ── push: show notification when status changes ───────────────────────────
self.addEventListener('push', e => {
  let data = {
    title: 'pulse',
    body: 'status updated',
  }

  if (e.data) {
    try {
      data = {
        ...data,
        ...e.data.json(),
      }
    } catch {
      // Keep default notification data if push payload is not JSON
    }
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: 'pulse-status',
      renotify: true,
      data: { url: '/' },
    })
  )
})

// ── notification click: open the app ─────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()

  e.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then(list => {
        const existing = list.find(client =>
          client.url.startsWith(self.location.origin)
        )

        if (existing) {
          return existing.focus()
        }

        return clients.openWindow('/')
      })
  )
})
