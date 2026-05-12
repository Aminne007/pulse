const CACHE = 'pulse-v1'
const ASSETS = ['/', '/index.html', '/manifest.json']

// ── install: cache core files ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  )
  self.skipWaiting()
})

// ── activate: clean old caches ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── fetch: serve from cache, fall back to network ─────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  )
})

// ── push: show notification when status changes ───────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'pulse', body: 'status updated' }

  if (e.data) {
    try { data = { ...data, ...e.data.json() } } catch {}
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      tag:     'pulse-status',       // replaces previous notification
      renotify: true,
      data:    { url: '/' },
    })
  )
})

// ── notification click: open the app ─────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow('/')
    })
  )
})