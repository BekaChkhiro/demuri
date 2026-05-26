// Narrow ambient declarations for the Cloudflare-Workers runtime globals the
// GalleryRoom Durable Object relies on. We deliberately do NOT add
// `@cloudflare/workers-types` to tsconfig `types` — that would replace the
// DOM `Request`/`Response`/`WebSocket` globals the rest of the (SvelteKit) app
// is typed against. Instead we augment only the two surfaces the DO touches.

declare global {
	/**
	 * Cloudflare's WebSocketPair constructor: returns a tuple-like object whose
	 * `[0]` is the client end (returned to the caller) and `[1]` is the server
	 * end (accepted by the Durable Object). Not part of the DOM lib.
	 */
	const WebSocketPair: {
		new (): { 0: WebSocket; 1: WebSocket };
	};

	/** Cloudflare extends ResponseInit with `webSocket` for 101 upgrade responses. */
	interface ResponseInit {
		webSocket?: WebSocket | null;
	}
}

export {};
