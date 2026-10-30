# CoCreate Service Worker

Service worker registration and lifecycle support for CoCreate. Importing the component registers the configured worker after the page loads. It does not require a DOM attribute or action.

## Install

```sh
yarn add @cocreate/service-worker
```

## Configure

The default worker path is `/service-worker.js`. Override it through `window.CoCreateConfig` before the CoCreate bundle loads:

```html
<script>
	window.CoCreateConfig = {
		serviceWorker: "/service-worker.js",
		cache: "false"
	};
</script>
```

The worker script is application-specific. Start from [`src/service-worker.js`](src/service-worker.js) and serve it from the same origin as the app. The component registers that script; it does not bundle it into the app or install it through a markup selector.

See [`demo/index.html`](demo/index.html) and [the documentation](docs/index.html).
