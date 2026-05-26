import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
	mergePhoto,
	parsePhotoNew,
	createGalleryStore,
	type GalleryPhoto
} from './gallery';

function photo(id: string, createdAt = 1000): GalleryPhoto {
	return { id, url: `https://cdn/${id}.jpg`, name: null, createdAt };
}

/** Minimal WebSocket stand-in driven manually by the test. */
class FakeSocket {
	static instances: FakeSocket[] = [];
	onopen: (() => void) | null = null;
	onmessage: ((e: { data: unknown }) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	closed = false;

	constructor(public url: string) {
		FakeSocket.instances.push(this);
	}

	close() {
		this.closed = true;
	}

	// Test helpers
	emitOpen() {
		this.onopen?.();
	}
	emitMessage(data: unknown) {
		this.onmessage?.({ data });
	}
	emitClose() {
		this.onclose?.();
	}
}

const envelope = (p: GalleryPhoto) => JSON.stringify({ type: 'photo:new', photo: p });

describe('mergePhoto', () => {
	it('prepends a new photo newest-first', () => {
		const result = mergePhoto([photo('a')], photo('b'));
		expect(result.map((p) => p.id)).toEqual(['b', 'a']);
	});

	it('ignores a photo whose id is already present (dedupe)', () => {
		const existing = [photo('a')];
		const result = mergePhoto(existing, photo('a'));
		expect(result).toBe(existing);
		expect(result.map((p) => p.id)).toEqual(['a']);
	});
});

describe('parsePhotoNew', () => {
	it('parses a well-formed photo:new envelope', () => {
		const p = photo('x', 42);
		expect(parsePhotoNew(envelope(p))).toEqual(p);
	});

	it('coerces a missing/non-string name to null', () => {
		const parsed = parsePhotoNew(
			JSON.stringify({ type: 'photo:new', photo: { id: 'x', url: 'u', createdAt: 1 } })
		);
		expect(parsed).toEqual({ id: 'x', url: 'u', name: null, createdAt: 1 });
	});

	it('rejects wrong type, malformed json, and missing fields', () => {
		expect(parsePhotoNew(JSON.stringify({ type: 'ping' }))).toBeNull();
		expect(parsePhotoNew('not json')).toBeNull();
		expect(parsePhotoNew(JSON.stringify({ type: 'photo:new', photo: { id: 'x' } }))).toBeNull();
		expect(parsePhotoNew(123)).toBeNull();
	});
});

describe('createGalleryStore', () => {
	beforeEach(() => {
		FakeSocket.instances = [];
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function makeStore(fetchFn: typeof fetch) {
		return createGalleryStore({
			fetchFn,
			createWebSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
			wsUrl: 'ws://test/api/ws',
			photosUrl: '/api/photos',
			reconnectBaseMs: 10,
			reconnectMaxMs: 100
		});
	}

	const okFetch = (photos: GalleryPhoto[]) =>
		vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ photos, nextBefore: null }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		) as unknown as typeof fetch;

	it('seeds from the API then opens a socket and goes live', async () => {
		const store = makeStore(okFetch([photo('a'), photo('b')]));
		await store.start();

		expect(get(store).photos.map((p) => p.id)).toEqual(['a', 'b']);
		expect(FakeSocket.instances).toHaveLength(1);

		FakeSocket.instances[0].emitOpen();
		expect(get(store).status).toBe('live');

		store.destroy();
	});

	it('prepends a live photo:new event and dedupes the client own upload', async () => {
		const store = makeStore(okFetch([photo('a')]));
		await store.start();
		const sock = FakeSocket.instances[0];
		sock.emitOpen();

		sock.emitMessage(envelope(photo('new', 2000)));
		expect(get(store).photos.map((p) => p.id)).toEqual(['new', 'a']);

		// Same id again (e.g. echoed back to its uploader) must not duplicate.
		sock.emitMessage(envelope(photo('new', 2000)));
		expect(get(store).photos.map((p) => p.id)).toEqual(['new', 'a']);

		store.destroy();
	});

	it('still opens the socket when the initial seed fails', async () => {
		const store = makeStore(
			vi.fn().mockResolvedValue(new Response('boom', { status: 500 })) as unknown as typeof fetch
		);
		await store.start();

		expect(get(store).status).toBe('error');
		expect(FakeSocket.instances).toHaveLength(1);

		// Live photos still stream in despite the failed seed.
		FakeSocket.instances[0].emitOpen();
		FakeSocket.instances[0].emitMessage(envelope(photo('live', 3000)));
		expect(get(store).photos.map((p) => p.id)).toEqual(['live']);

		store.destroy();
	});

	it('reconnects with backoff after the socket closes', async () => {
		const store = makeStore(okFetch([]));
		await store.start();
		FakeSocket.instances[0].emitOpen();

		FakeSocket.instances[0].emitClose();
		expect(get(store).status).toBe('reconnecting');
		expect(FakeSocket.instances).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(10);
		expect(FakeSocket.instances).toHaveLength(2);

		store.destroy();
	});

	it('does not reconnect after destroy()', async () => {
		const store = makeStore(okFetch([]));
		await store.start();
		const sock = FakeSocket.instances[0];
		sock.emitOpen();

		store.destroy();
		expect(sock.closed).toBe(true);

		sock.emitClose();
		await vi.advanceTimersByTimeAsync(200);
		expect(FakeSocket.instances).toHaveLength(1);
	});
});
