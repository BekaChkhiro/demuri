import { writable, type Readable } from 'svelte/store';

/**
 * Client-facing shape of a gallery photo. Mirrors the server's `PhotoResponse`
 * (src/lib/server/photos.ts) but is declared independently so client code never
 * imports the server module (which pulls in `@cloudflare/workers-types`).
 */
export interface GalleryPhoto {
	id: string;
	url: string;
	name: string | null;
	createdAt: number;
}

export type GalleryStatus = 'idle' | 'loading' | 'live' | 'reconnecting' | 'error';

export interface GalleryState {
	/** Newest-first, de-duplicated by id. */
	photos: GalleryPhoto[];
	status: GalleryStatus;
	/** Last non-fatal error message (e.g. the initial seed failed), else null. */
	error: string | null;
	/** Cursor for the next older page, or null when the wall is fully loaded. */
	nextBefore: number | null;
	/** True while an older page is being fetched (for the scroll loader). */
	loadingMore: boolean;
}

/** Shape of GET /api/photos — only the fields the client consumes. */
interface PhotoListResponse {
	photos: GalleryPhoto[];
	nextBefore: number | null;
}

export interface GalleryStoreOptions {
	/** Injectable for tests; defaults to the global `fetch`. */
	fetchFn?: typeof fetch;
	/** Injectable for tests; defaults to constructing a real `WebSocket`. */
	createWebSocket?: (url: string) => WebSocket;
	/** Override the photos endpoint (default `/api/photos`). */
	photosUrl?: string;
	/** Override the websocket URL (default derived from `location`). */
	wsUrl?: string;
	/** Base delay before the first reconnect attempt, ms (default 1000). */
	reconnectBaseMs?: number;
	/** Upper bound on the exponential reconnect backoff, ms (default 15000). */
	reconnectMaxMs?: number;
}

export interface GalleryStore extends Readable<GalleryState> {
	/** Seed from the API then open the live socket. A no-op after the first call. */
	start(): Promise<void>;
	/** Fetch the next older page (cursor-based). No-op when fully loaded or busy. */
	loadMore(): Promise<void>;
	/** Close the socket and stop reconnecting. */
	destroy(): void;
}

/**
 * Prepend an incoming photo, newest-first, de-duplicated by id. A photo whose
 * id is already present is returned unchanged so a client never shows a photo
 * (including its own upload) twice.
 */
export function mergePhoto(photos: GalleryPhoto[], incoming: GalleryPhoto): GalleryPhoto[] {
	if (photos.some((p) => p.id === incoming.id)) {
		return photos;
	}
	return [incoming, ...photos];
}

/**
 * Remove a photo by id, returning the same array reference when the id is absent
 * so the store update is a no-op (identity check).
 */
export function removePhoto(photos: GalleryPhoto[], id: string): GalleryPhoto[] {
	const idx = photos.findIndex((p) => p.id === id);
	if (idx === -1) return photos;
	return [...photos.slice(0, idx), ...photos.slice(idx + 1)];
}

/**
 * Parse a raw WebSocket frame into a photo id, or null if it isn't a
 * well-formed `photo:remove` envelope. Defensive on purpose — a malformed frame
 * must never throw inside the socket handler.
 */
export function parsePhotoRemove(data: unknown): string | null {
	if (typeof data !== 'string') return null;

	let msg: unknown;
	try {
		msg = JSON.parse(data);
	} catch {
		return null;
	}
	if (!msg || typeof msg !== 'object') return null;

	const envelope = msg as { type?: unknown; id?: unknown };
	if (envelope.type !== 'photo:remove' || typeof envelope.id !== 'string') return null;

	return envelope.id;
}

/**
 * Parse a raw WebSocket frame into a `GalleryPhoto`, or null if it isn't a
 * well-formed `photo:new` envelope. Defensive on purpose — a malformed frame
 * must never throw inside the socket handler.
 */
export function parsePhotoNew(data: unknown): GalleryPhoto | null {
	if (typeof data !== 'string') return null;

	let msg: unknown;
	try {
		msg = JSON.parse(data);
	} catch {
		return null;
	}
	if (!msg || typeof msg !== 'object') return null;

	const envelope = msg as { type?: unknown; photo?: unknown };
	if (envelope.type !== 'photo:new' || !envelope.photo || typeof envelope.photo !== 'object') {
		return null;
	}

	const p = envelope.photo as Record<string, unknown>;
	if (typeof p.id !== 'string' || typeof p.url !== 'string' || typeof p.createdAt !== 'number') {
		return null;
	}

	return {
		id: p.id,
		url: p.url,
		name: typeof p.name === 'string' ? p.name : null,
		createdAt: p.createdAt
	};
}

/** Build the websocket URL from the current page origin (browser only). */
function defaultWsUrl(): string {
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${location.host}/api/ws`;
}

/**
 * Create the live gallery store. It seeds from GET /api/photos, then opens a
 * WebSocket to /api/ws and merges `photo:new` events (deduping by id). The
 * socket auto-reconnects with exponential backoff; `destroy()` stops it.
 *
 * All side-effecting dependencies (`fetch`, `WebSocket`, the URLs) are
 * injectable so the seed/merge/reconnect behaviour is unit-testable in node.
 */
export function createGalleryStore(options: GalleryStoreOptions = {}): GalleryStore {
	const fetchFn = options.fetchFn ?? fetch;
	const makeSocket = options.createWebSocket ?? ((url: string) => new WebSocket(url));
	const photosUrl = options.photosUrl ?? '/api/photos';
	const reconnectBaseMs = options.reconnectBaseMs ?? 1000;
	const reconnectMaxMs = options.reconnectMaxMs ?? 15000;

	const { subscribe, update, set } = writable<GalleryState>({
		photos: [],
		status: 'idle',
		error: null,
		nextBefore: null,
		loadingMore: false
	});

	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let attempts = 0;
	let destroyed = false;
	let started = false;
	let loadingMore = false;
	let nextBefore: number | null = null;
	let visibilityHandler: (() => void) | null = null;

	function setStatus(status: GalleryStatus, error: string | null = null): void {
		update((s) => ({ ...s, status, error }));
	}

	function ingest(photo: GalleryPhoto): void {
		update((s) => ({ ...s, photos: mergePhoto(s.photos, photo) }));
	}

	async function gapFill(): Promise<void> {
		try {
			const res = await fetchFn(photosUrl);
			if (!res.ok) return;
			const data = (await res.json()) as PhotoListResponse;
			const photos = Array.isArray(data?.photos) ? data.photos : [];
			for (const p of photos) {
				ingest(p);
			}
		} catch {
			// Best-effort only — a gap-fill failure is non-fatal.
		}
	}

	function openSocket(): void {
		if (destroyed) return;

		let ws: WebSocket;
		try {
			ws = makeSocket(options.wsUrl ?? defaultWsUrl());
		} catch {
			scheduleReconnect();
			return;
		}
		socket = ws;

		ws.onopen = () => {
			if (destroyed) return;
			attempts = 0;
			setStatus('live');
			gapFill();
		};
		ws.onmessage = (event: MessageEvent) => {
			const photo = parsePhotoNew(event.data);
			if (photo) {
				ingest(photo);
				return;
			}
			const removedId = parsePhotoRemove(event.data);
			if (removedId) {
				update((s) => ({ ...s, photos: removePhoto(s.photos, removedId) }));
			}
		};
		ws.onclose = () => {
			if (destroyed) return;
			socket = null;
			scheduleReconnect();
		};
		ws.onerror = () => {
			// A close event follows an error and drives the reconnect — nothing to do here.
		};
	}

	function scheduleReconnect(): void {
		if (destroyed || reconnectTimer) return;
		setStatus('reconnecting');
		// Pause while the tab is hidden; visibilitychange will call openSocket() on focus.
		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
			return;
		}
		const base = Math.min(reconnectBaseMs * 2 ** attempts, reconnectMaxMs);
		const delay = base + Math.floor(Math.random() * base * 0.25);
		attempts++;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			openSocket();
		}, delay);
	}

	async function start(): Promise<void> {
		if (started) return;
		started = true;

		setStatus('loading');
		try {
			const res = await fetchFn(photosUrl);
			if (!res.ok) throw new Error(`Failed to load photos (${res.status})`);
			const data = (await res.json()) as PhotoListResponse;
			const photos = Array.isArray(data?.photos) ? data.photos : [];
			nextBefore = data?.nextBefore ?? null;
			set({ photos, status: 'loading', error: null, nextBefore, loadingMore: false });
		} catch (e) {
			// Non-fatal: keep going live so freshly uploaded photos still stream in.
			setStatus('error', e instanceof Error ? e.message : 'Failed to load gallery');
		}

		if (typeof document !== 'undefined') {
			visibilityHandler = () => {
				if (document.visibilityState === 'visible' && !destroyed && !socket && !reconnectTimer) {
					openSocket();
				}
			};
			document.addEventListener('visibilitychange', visibilityHandler);
		}

		openSocket();
	}

	async function loadMore(): Promise<void> {
		if (destroyed || loadingMore || nextBefore === null) return;
		loadingMore = true;
		update((s) => ({ ...s, loadingMore: true }));
		try {
			const res = await fetchFn(`${photosUrl}?before=${nextBefore}`);
			if (!res.ok) throw new Error(`Failed to load more (${res.status})`);
			const data = (await res.json()) as PhotoListResponse;
			const older = Array.isArray(data?.photos) ? data.photos : [];
			nextBefore = data?.nextBefore ?? null;
			update((s) => {
				const merged = [...s.photos];
				for (const p of older) {
					if (!merged.some((x) => x.id === p.id)) merged.push(p);
				}
				return { ...s, photos: merged, nextBefore, loadingMore: false };
			});
		} catch {
			// Non-fatal: leave the cursor in place so a later scroll can retry.
			update((s) => ({ ...s, loadingMore: false }));
		} finally {
			loadingMore = false;
		}
	}

	function destroy(): void {
		destroyed = true;
		if (visibilityHandler && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', visibilityHandler);
			visibilityHandler = null;
		}
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (socket) {
			socket.onopen = null;
			socket.onmessage = null;
			socket.onclose = null;
			socket.onerror = null;
			try {
				socket.close();
			} catch {
				// Already closing — nothing to do.
			}
			socket = null;
		}
	}

	return { subscribe, start, loadMore, destroy };
}
