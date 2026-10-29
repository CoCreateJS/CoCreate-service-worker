# CoCreate-service-worker

Service worker registration and lifecycle support for CoCreate.

## Install

```sh
yarn add @cocreate/service-worker
```

Or load the browser bundle from `https://cdn.cocreate.app/service-worker/latest/CoCreate-service-worker.min.js`.

## Usage

Set the service-worker attribute on an element to register the worker URL it contains. If no path is provided, /service-worker.js is used. The service-worker script is application-specific: start from [`src/service-worker.js`](src/service-worker.js), then serve it from the same origin as your app. The CoCreate loader does not bundle or silently install that script.

```html
<html service-worker="/service-worker.js">
```

See [`demo/index.html`](demo/index.html) and the [documentation](docs/index.html).
