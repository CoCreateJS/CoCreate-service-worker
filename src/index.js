import Observer from "@cocreate/observer";

const selector = "[service-worker]";
const registrations = new Map();

function getWorkerUrl(element) {
    const value = element?.getAttribute(selector.slice(1, -1));
    if (value === "false") return null;
    return value || window.CoCreateConfig?.serviceWorker || "/service-worker.js";
}

async function register(element) {
    if (!("serviceWorker" in navigator)) return null;

    const workerUrl = getWorkerUrl(element);
    if (!workerUrl) return null;
    if (registrations.has(workerUrl)) return registrations.get(workerUrl);

    const promise = navigator.serviceWorker.register(workerUrl).catch((error) => {
        registrations.delete(workerUrl);
        throw error;
    });
    registrations.set(workerUrl, promise);
    return promise;
}

function init(root = document) {
    const elements = [];
    if (root?.matches?.(selector)) elements.push(root);
    if (root?.querySelectorAll) elements.push(...root.querySelectorAll(selector));
    if (!elements.length && root === document && window.CoCreateConfig?.serviceWorker)
        return register();
    return Promise.all(elements.map((element) => register(element).catch((error) => {
        console.error("Service worker registration failed", error);
        return null;
    })));
}

Observer.init({
    name: "serviceWorker",
    types: ["addedNodes", "attributes"],
    selector,
    callback: (mutation) => init(mutation.target)
});

init();

export default { init, register };
