import type {
	DurableObjectState,
	WebSocket as CfWebSocket
} from '@cloudflare/workers-types';
import type { Env } from './env';

/**
 * Internal path used to fan a message out to every connected client. This is
 * reached only via the GALLERY binding's `fetch` from trusted server code
 * (e.g. the upload handler) — it is never exposed on the public router.
 */
export const BROADCAST_PATH = '/broadcast';

/**
 * GalleryRoom — the single Durable Object that holds every live gallery
 * WebSocket connection.
 *
 * There is exactly one instance for the whole app (addressed via a fixed name,
 * see the /api/ws route). It accepts WebSocket upgrades, tracks the open
 * sockets, and exposes an internal `/broadcast` entrypoint that fans a message
 * out to all of them.
 *
 * Sockets are accepted with the Hibernatable WebSockets API
 * (`state.acceptWebSocket`) so the DO is evicted from memory while idle and
 * billed only when messages actually flow — the connection itself survives
 * hibernation, and `getWebSockets()` always reflects the live set.
 *
 * Note: typed against the Cloudflare runtime, where `Request`/`Response`/
 * `WebSocket` are the global (DOM-compatible) types. The DO state and sockets
 * use `@cloudflare/workers-types`; we cast only at that boundary.
 */
export class GalleryRoom {
	private readonly state: DurableObjectState;

	constructor(state: DurableObjectState, _env: Env) {
		this.state = state;
	}

	/**
	 * Two roles, distinguished by path:
	 *   • GET /api/ws (Upgrade: websocket) → accept and register a client socket
	 *   • POST /broadcast                  → fan the body out to every client
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === BROADCAST_PATH) {
			return this.handleBroadcast(request);
		}

		if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
			return this.handleUpgrade();
		}

		return new Response('Expected WebSocket upgrade', { status: 426 });
	}

	/**
	 * Accept a client WebSocket. The server half is handed to the runtime via
	 * `acceptWebSocket` (hibernatable); the client half is returned in the 101
	 * response. Bookkeeping is delegated to the runtime — `getWebSockets()`
	 * always reflects the currently-open set, including across hibernation.
	 */
	private handleUpgrade(): Response {
		const { 0: client, 1: server } = new WebSocketPair();

		this.state.acceptWebSocket(server as unknown as CfWebSocket);

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	/**
	 * Fan a message out to every live socket. The request body is forwarded
	 * verbatim, so callers control the payload shape (e.g. a `photo:new`
	 * envelope). Closed/errored sockets are skipped silently.
	 */
	private async handleBroadcast(request: Request): Promise<Response> {
		const payload = await request.text();
		const sockets = this.state.getWebSockets();

		let delivered = 0;
		for (const socket of sockets) {
			try {
				socket.send(payload);
				delivered++;
			} catch {
				// Socket is mid-close or already gone — drop it and move on.
			}
		}

		return Response.json({ delivered });
	}

	/**
	 * Hibernation handler: a client closed its socket. Close our half too so the
	 * runtime drops it from `getWebSockets()`. We don't echo client messages, so
	 * `webSocketMessage` is intentionally absent — incoming frames are ignored.
	 */
	async webSocketClose(ws: CfWebSocket, code: number): Promise<void> {
		// 1006 (abnormal) cannot be sent back; codes < 1000 are invalid — use 1000.
		const safeCode = code === 1006 || code < 1000 ? 1000 : code;
		try {
			ws.close(safeCode);
		} catch {
			// Already closing — nothing to do.
		}
	}

	/** A socket errored; the runtime has already dropped it. Nothing to clean up. */
	async webSocketError(): Promise<void> {
		// No-op: getWebSockets() no longer includes the errored socket.
	}
}
