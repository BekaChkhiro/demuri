import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
	mergePhoto,
	parsePhotoNew,
	parsePhotoRemove,
	removePhoto,
	createGalleryStore,
	type GalleryPhoto
} from './gallery';

// Flush the microtask queue without touching the fake-timer clock.
// Ten ticks cover fetch + Response.json() body-parsing chain + extras.
const flushPromises = async () => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

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
const removeEnvelope = (id: string) => JSON.stringify({ type: 'photo:remove', id });

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

describe('removePhoto', () => {
	it('removes the photo with the given id', () => {
		const result = removePhoto([photo('a'), photo('b'), photo('c')], 'b');
		expect(result.map((p) => p.id)).toEqual(['a', 'c']);
	});

	it('returns the same array reference when the id is absent (no-op)', () => {
		const arr = [photo('a'), photo('b')];
		expect(removePhoto(arr, 'z')).toBe(arr);
	});
});

describe('parsePhotoRemove', () => {
	it('parses a well-formed photo:remove envelope', () => {
		expect(parsePhotoRemove(removeEnvelope('abc-123'))).toBe('abc-123');
	});

	it('rejects wrong type, malformed json, and missing/non-string id', () => {
		expect(parsePhotoRemove(JSON.stringify({ type: 'photo:new', id: 'x' }))).toBeNull();
		expect(parsePhotoRemove('not json')).toBeNull();
		expect(parsePhotoRemove(JSON.stringify({ type: 'photo:remove' }))).toBeNull();
		expect(parsePhotoRemove(JSON.stringify({ type: 'photo:remove', id: 42 }))).toBeNull();
		expect(parsePhotoRemove(123)).toBeNull();
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

	it('removes a photo on photo:remove and is idempotent for unknown ids', async () => {
		const store = makeStore(okFetch([photo('a'), photo('b'), photo('c')]));
		await store.start();
		const sock = FakeSocket.instances[0];
		sock.emitOpen();

		sock.emitMessage(removeEnvelope('b'));
		expect(get(store).photos.map((p) => p.id)).toEqual(['a', 'c']);

		// Unknown id — store unchanged.
		sock.emitMessage(removeEnvelope('z'));
		expect(get(store).photos.map((p) => p.id)).toEqual(['a', 'c']);

		store.destroy();
	});

	it('reconnects with backoff after the socket closes', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0); // disable jitter for deterministic timing
		const store = makeStore(okFetch([]));
		await store.start();
		FakeSocket.instances[0].emitOpen();
		await flushPromises();

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
		await flushPromises();

		store.destroy();
		expect(sock.closed).toBe(true);

		sock.emitClose();
		await vi.advanceTimersByTimeAsync(200);
		expect(FakeSocket.instances).toHaveLength(1);
	});

	it('gap-fills on reconnect: fetches latest photos and dedupes', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ photos: [photo('a', 1000)], nextBefore: null }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
			.mockResolvedValue(
				new Response(
					JSON.stringify({
						photos: [photo('new', 2000), photo('a', 1000)],
						nextBefore: null
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			) as unknown as typeof fetch;

		const store = makeStore(fetchFn);
		await store.start();
		FakeSocket.instances[0].emitOpen();
		await flushPromises();

		// gap-fill merged 'new' and deduped 'a'
		expect(get(store).photos.map((p) => p.id)).toEqual(['new', 'a']);
		store.destroy();
	});

	it('jitters the backoff delay (delay varies between runs)', async () => {
		// Two separate stores, one with random=0, one with random=1 — delays differ.
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const storeA = makeStore(okFetch([]));
		await storeA.start();
		FakeSocket.instances[0].emitClose();
		// With random=0: delay = 10 + floor(0) = 10 ms — timer fires after 10.
		await vi.advanceTimersByTimeAsync(10);
		const sockCountA = FakeSocket.instances.length;
		storeA.destroy();
		FakeSocket.instances = [];

		vi.spyOn(Math, 'random').mockReturnValue(0.99);
		const storeB = makeStore(okFetch([]));
		await storeB.start();
		FakeSocket.instances[0].emitClose();
		// With random=0.99: delay = 10 + floor(0.99 * 2.5) = 10 + 2 = 12 ms — not yet fired after 10.
		await vi.advanceTimersByTimeAsync(10);
		const sockCountBAtTen = FakeSocket.instances.length;
		await vi.advanceTimersByTimeAsync(5);
		const sockCountBAtFifteen = FakeSocket.instances.length;
		storeB.destroy();

		expect(sockCountA).toBe(2); // reconnected after 10 ms
		expect(sockCountBAtTen).toBe(1); // not yet reconnected at 10 ms
		expect(sockCountBAtFifteen).toBe(2); // reconnected by 15 ms
	});

	it('pauses reconnect while tab is hidden and resumes on visibilitychange', async () => {
		const visListeners: Array<() => void> = [];
		const mockDoc = {
			visibilityState: 'visible' as DocumentVisibilityState,
			addEventListener: (_: string, fn: () => void) => visListeners.push(fn),
			removeEventListener: () => {}
		};
		Object.defineProperty(globalThis, 'document', { value: mockDoc, configurable: true });

		try {
			vi.spyOn(Math, 'random').mockReturnValue(0);
			const store = makeStore(okFetch([]));
			await store.start();
			FakeSocket.instances[0].emitOpen();
			await flushPromises();

			// Simulate tab going hidden, then socket closes.
			mockDoc.visibilityState = 'hidden';
			FakeSocket.instances[0].emitClose();
			expect(get(store).status).toBe('reconnecting');

			// Even after the normal backoff interval, no new socket while hidden.
			await vi.advanceTimersByTimeAsync(50);
			expect(FakeSocket.instances).toHaveLength(1);

			// Tab becomes visible — visibilitychange fires.
			mockDoc.visibilityState = 'visible';
			visListeners.forEach((fn) => fn());
			expect(FakeSocket.instances).toHaveLength(2);

			store.destroy();
		} finally {
			// @ts-expect-error restore
			delete globalThis.document;
		}
	});
});
