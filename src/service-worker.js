/********************************************************************************
 * Copyright (C) 2023 CoCreate and Contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 ********************************************************************************/

/**
 * Commercial Licensing Information:
 * For commercial use of this software without the copyleft provisions of the AGPLv3,
 * you must obtain a commercial license from CoCreate LLC.
 * For details, visit <https://cocreate.app/licenses/> or contact us at sales@cocreate.app.
 */

const cacheName = "dynamic-v2";
const updatedOn = new Date('2024-04-29T14:05:43.414Z');

let organization_id = ""
let storage = true

const queryString = self.location.search;
const queryParams = new URLSearchParams(queryString);
let cacheType = queryParams.get('cache');

// Private responses use the browser HTTP cache, not the worker's shared asset cache.
function canUseAssetCache(response) {
    if (!response) return false;
    const policy = response.headers.get("Cache-Control") || "";
    if (!/(?:^|,)\s*public\s*(?:,|$)/i.test(policy) ||
        /(?:^|,)\s*(?:private|no-cache|no-store|must-revalidate|proxy-revalidate)\b/i.test(policy)) return false;
    const age = policy.match(/(?:^|,)\s*max-age=(\d+)\s*(?:,|$)/i);
    const date = Date.parse(response.headers.get("Date"));
    const elapsed = (Date.now() - date) / 1000 + Number(response.headers.get("Age") || 0);
    return age && Number.isFinite(elapsed) && elapsed < Number(age[1]);
}

// Ask the requesting page for its current Config token; do not persist a second copy.
async function applySessionToken(event, request = event.request) {
    if (new URL(request.url).origin !== self.location.origin) return request;
    if (request.headers.has("Authorization")) return request;
    const client = event.clientId && await self.clients.get(event.clientId);
    if (!client) return request;

    const token = await new Promise((resolve) => {
        const channel = new MessageChannel();
        const finish = (value) => {
            clearTimeout(timeout);
            channel.port1.close();
            channel.port2.close();
            resolve(value);
        };
        const timeout = setTimeout(() => finish(null), 1000);
        channel.port1.onmessage = (message) => finish(message.data?.token);
        try {
            client.postMessage({ action: "getSessionToken" }, [channel.port2]);
        } catch {
            finish(null);
        }
    });
    if (typeof token !== "string" || !token) return request;
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return new Request(request, {
        headers,
        // Native image requests use no-cors, which strips Authorization.
        ...(request.mode === "no-cors" ? { mode: "same-origin" } : {})
    });
}

self.addEventListener("install", (e) => {
    console.log('Service Worker Installing')
    self.skipWaiting();
});

// self.addEventListener("activate", async (e) => {
//     e.waitUntil(clients.claim());
// });

self.addEventListener('activate', event => {
    event.waitUntil(
        clients.claim().then(() => {
            return clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.navigate(client.url));
            });
        })
    );
});

self.addEventListener("fetch", async (e) => {
    if (!(e.request.url.indexOf('http') === 0)) return;
    if (e.request.method !== 'GET') {
        e.respondWith(applySessionToken(e).then(request => fetch(request)));
        return;
    }

    e.respondWith(
        caches
            .match(e.request)
            .then(async (cacheResponse) => {
                    if (!canUseAssetCache(cacheResponse)) cacheResponse = null;
                const request = await applySessionToken(e);
                if (request.headers.has("Authorization")) return fetch(request);
                let fetchedOn
                if (cacheResponse && cacheType !== 'false') {
                    fetchedOn = cacheResponse.headers.get('fetched-on')
                    if (fetchedOn)
                        fetchedOn = new Date(fetchedOn)
                }


                if ((!navigator.onLine && cacheResponse) || !!cacheResponse && cacheType !== 'false' && (!fetchedOn || fetchedOn > updatedOn)) {
                    const organization = cacheResponse.headers.get('organization')
                    console.log('servering cache fetchOn greater', fetchedOn > updatedOn, organization)
                    const lastModified = cacheResponse.headers.get('last-modified')
                    sendCacheUpdate(e.request.url, organization, lastModified);
                    return cacheResponse;
                } else {
                    console.log('fetching fetchOn less', fetchedOn > updatedOn)

                    const networkResponse = await fetch(e.request);
                        if (!canUseAssetCache(networkResponse)) return networkResponse;

                    if (!organization_id)
                        organization_id = networkResponse.headers.get('organization')

                    let storageHeader = networkResponse.headers.get('storage')
                    if (storageHeader)
                        storage = storageHeader

                    if (cacheType && cacheType !== 'false' && networkResponse.status === 200) {
                        console.log('caching')

                        caches.open(cacheName).then((cache) => {
                            if (networkResponse.status !== 206) {
                                const networkModified = networkResponse.headers.get('last-modified');
                                // if (!networkModified) {
                                //     networkResponse.headers.set('Last-Modified', new Date().toISOString());
                                // }
                                cache.put(e.request, networkResponse);
                                if (cacheType === 'reload' || cacheType === 'prompt') {
                                    const cacheModified = cacheResponse.headers.get('last-modified');
                                    if (networkModified !== cacheModified) {
                                        self.clients.matchAll().then((clients) => {
                                            clients.forEach((client) => {
                                                client.postMessage({ action: 'cacheType', cacheType }); // Send a custom message
                                                console.log(`file ${cacheType} has been triggered`)
                                            });
                                        });
                                    }
                                }
                            }
                        }).catch(() => {

                        });
                    }

                    if (!cacheResponse || cacheType === 'false' || cacheType === 'offline') {
                        return networkResponse.clone();
                    }

                }

                if (!!cacheResponse && cacheType !== 'false' && cacheType !== 'offline') {
                    return cacheResponse;
                }

            })
            .catch(function () {
                return caches.match('./offline.html');
            })
    );
});

self.addEventListener('message', function (event) {
    if (event.data.action === 'getOrganization')
        event.source.postMessage({ action: 'getOrganization', organization_id });
    else if (event.data.action === 'checkCache') {
        event.source.postMessage({ action: 'checkCache', returnedFromCache: { ...returnedFromCache } });
        returnedFromCache = {}
    }
});


self.addEventListener('push', (event) => {
    const pushData = event.data.json(); // Assuming the push payload is JSON data

    // Process the push notification data as needed
    const { socketUrl, _id } = pushData;

    // Establish a WebSocket connection
    const socket = new WebSocket(socketUrl);

    // Handle WebSocket events
    socket.addEventListener('open', () => {
        // The WebSocket connection is open, send the message to the server
        socket.send(JSON.stringify({ method: 'object.read', array: 'files', object: { _id },  uuid: '' }));
    });

    socket.addEventListener('message', (event) => {
        // Handle messages received from the server over the WebSocket
        const serverData = JSON.parse(event.data);
        if (serverData.uuid ===  uuid) {
            // TODO: add file to cache and close socket
        }
    });

    socket.addEventListener('close', () => {
        // Handle the WebSocket connection being closed
        console.log('WebSocket connection closed.');
    });

    socket.addEventListener('error', (error) => {
        // Handle WebSocket errors
        console.error('WebSocket error:', error);
    });

    // Ensure that the service worker stays active until the WebSocket connection is closed
    event.waitUntil(
        new Promise((resolve) => {
            socket.addEventListener('close', () => {
                resolve();
            });
        })
    );
});

let returnedFromCache = {};
let fetchTimeout = null;
const sendCacheUpdate = (url, organization, lastModified) => {

    returnedFromCache[url] = { organization, lastModified };

    if (fetchTimeout) {
        clearTimeout(fetchTimeout);
    }
    const self = this
    fetchTimeout = setTimeout(() => {
        self.clients.matchAll().then(clients => {
            if (clients.length > 0) {
                clients[0].postMessage({ action: 'checkCache', returnedFromCache });
            }
        });

        fetchTimeout = null;
        // returnedFromCache = {};
    }, 500);
};

// self.addEventListener('backgroundfetchsuccess', (event) => {
//     const bgFetch = event.registration;

//     event.waitUntil(async function() {
//       // Create/open a cache.
//       const cache = await caches.open(cacheName);
//       // Get all the records.
//       const records = await bgFetch.matchAll();
//       // Copy each request/response across.
//       const promises = records.map(async (record) => {
//         const response = await record.responseReady;
//         console.log('putting ')
//         await cache.put(record.request, response);
//       });

//       // Wait for the copying to complete
//       await Promise.all(promises);

//       // Update the progress notification.
//     //   event.updateUI({ title: 'Episode 5 ready to listen!' });
//     }());
//   });
