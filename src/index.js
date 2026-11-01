const registrations = new Map();

function getStorageValue(key) {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function setStorageValue(key, value) {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Service worker registration can still proceed without local storage.
	}
}

function getWorkerUrl(workerPath) {
	const config = window.CoCreateConfig || {};
	const path =
		workerPath ||
		config.serviceWorker ||
		getStorageValue("serviceWorker") ||
		"/service-worker.js";
	const cache = config.cache || getStorageValue("cache") || "false";

	setStorageValue("serviceWorker", path);
	setStorageValue("cache", cache);

	const url = new URL(path, window.location.href);
	url.searchParams.set("cache", cache);
	return url.href;
}

/**
 *
 * @public
 * @environment client
 */
async function register(workerPath) {
	if (!("serviceWorker" in navigator)) return null;

	const url = getWorkerUrl(workerPath);
	if (registrations.has(url)) return registrations.get(url);

	const promise = navigator.serviceWorker.register(url).catch((error) => {
		registrations.delete(url);
		throw error;
	});
	registrations.set(url, promise);
	return promise;
}

/**
 *
 * @public
 * @environment client
 */
function init() {
	if (!("serviceWorker" in navigator)) return Promise.resolve(null);
	if (document.readyState === "complete") return register();

	return new Promise((resolve, reject) => {
		window.addEventListener(
			"load",
			() => register().then(resolve, reject),
			{ once: true }
		);
	});
}

init().catch((error) => console.error("Service worker registration failed", error));

export default { init, register };

/**
 * Service worker registration and lifecycle support for CoCreate.
 *
 * @module service-worker
 * @environment client
 */
