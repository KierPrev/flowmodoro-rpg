// Service Worker para notificaciones push en Flowmodoro RPG
const CACHE_NAME = 'flowmodoro-rpg-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css',
    '/particles.js',
    '/notify.wav',
    '/flowmodoro-rpg.png',
    '/manifest.json'
];

// Instalación del service worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// Activación del service worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Manejo de fetch para cache offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Manejo de notificaciones push (para futuras implementaciones)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/flowmodoro-rpg.png',
            badge: '/flowmodoro-rpg.png',
            vibrate: [200, 100, 200],
            data: data.data || {},
            requireInteraction: true,
            silent: false
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si ya hay una ventana abierta, enfocarla
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no hay ventana abierta, abrir una nueva
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Manejo de mensajes desde el cliente principal
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NOTIFICATION_REQUEST') {
        const { title, body, icon } = event.data;
        const options = {
            body: body,
            icon: icon || '/flowmodoro-rpg.png',
            badge: '/flowmodoro-rpg.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            silent: false,
            tag: 'flowmodoro-notification' // Evita notificaciones duplicadas
        };

        self.registration.showNotification(title, options);
    }
});