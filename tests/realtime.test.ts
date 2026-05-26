import { describe, it, expect, vi } from 'vitest';
import { GalleryRoom, BROADCAST_PATH } from '$lib/server/GalleryRoom';
import { broadcastToGallery } from '$lib/server/gallery';

type Socket = { send: ReturnType<typeof vi.fn> };

function makeSocket(): Socket {
	return { send: vi.fn() };
}

/**
 * Stateful fake DO state: acceptWebSocket accumulates sockets into a shared
 * array that getWebSockets returns — mirrors the runtime's hibernation registry.
 */
function makeState(initial: Socket[] = []) {
	const sockets: Socket[] = [...initial];
	return {
		acceptWebSocket: vi.fn((ws: Socket) => sockets.push(ws)),
		getWebSockets: vi.fn((): Socket[] => sockets)
	};
}

function makeRoom(sockets: Socket[] = []) {
	const state = makeState(sockets);
	const room = new GalleryRoom(state as never, {} as never);
	return { room, state };
}

/** Fake DO namespace that routes fetch() directly to the given room. */
function makeGalleryBinding(room: GalleryRoom) {
	const id = {};
	const stub = {
		fetch: (url: string, init: RequestInit) => room.fetch(new Request(url, init))
	};
	return {
		idFromName: vi.fn().mockReturnValue(id),
		get: vi.fn().mockReturnValue(stub)
	};
}

function broadcastRequest(message: unknown) {
	return new Request(`https://gallery.internal${BROADCAST_PATH}`, {
		method: 'POST',
		body: JSON.stringify(message)
	});
}

function photoMessage(photoOverride: Record<string, unknown> = {}) {
	return {
		type: 'photo:new',
		photo: {
			id: 'photo-abc',
			url: 'https://cdn.example.com/photos/photo-abc.jpg',
			name: 'Beach Sunset',
			createdAt: 1_700_000_000_000,
			...photoOverride
		}
	};
}

describe('realtime broadcast — two connected clients receive photo:new', () => {
	it('both clients receive exactly one photo:new with the correct payload', async () => {
		const socket1 = makeSocket();
		const socket2 = makeSocket();
		const { room } = makeRoom([socket1, socket2]);

		const message = photoMessage();
		const res = await room.fetch(broadcastRequest(message));

		const payload = JSON.stringify(message);
		expect(socket1.send).toHaveBeenCalledOnce();
		expect(socket1.send).toHaveBeenCalledWith(payload);
		expect(socket2.send).toHaveBeenCalledOnce();
		expect(socket2.send).toHaveBeenCalledWith(payload);
		expect(await res.json()).toEqual({ delivered: 2 });
	});

	it('photo:new payload matches the listing item shape — id, url, name, createdAt', async () => {
		const socket = makeSocket();
		const { room } = makeRoom([socket]);

		const photo = {
			id: 'p1',
			url: 'https://cdn.example.com/photos/p1.jpg',
			name: 'Gallery Shot',
			createdAt: 1_700_000_001_000
		};
		await room.fetch(broadcastRequest({ type: 'photo:new', photo }));

		const received: { type: string; photo: Record<string, unknown> } = JSON.parse(
			socket.send.mock.calls[0][0] as string
		);
		expect(received.type).toBe('photo:new');
		expect(received.photo).toMatchObject({
			id: expect.any(String),
			url: expect.stringContaining('https://cdn.example.com/photos/'),
			name: expect.any(String),
			createdAt: expect.any(Number)
		});
		expect(received.photo).toEqual(photo);
	});

	it('each socket receives the payload exactly once — no duplicate messages', async () => {
		const socket1 = makeSocket();
		const socket2 = makeSocket();
		const { room } = makeRoom([socket1, socket2]);

		await room.fetch(broadcastRequest(photoMessage()));

		expect(socket1.send).toHaveBeenCalledTimes(1);
		expect(socket2.send).toHaveBeenCalledTimes(1);
	});

	it('a client that connects after a broadcast does not receive the missed message', async () => {
		const earlySocket = makeSocket();
		const { room, state } = makeRoom([earlySocket]);

		await room.fetch(broadcastRequest(photoMessage({ id: 'first' })));

		const lateSocket = makeSocket();
		state.acceptWebSocket(lateSocket);

		await room.fetch(broadcastRequest(photoMessage({ id: 'second' })));

		expect(earlySocket.send).toHaveBeenCalledTimes(2);
		expect(lateSocket.send).toHaveBeenCalledTimes(1);
		const received: { photo: { id: string } } = JSON.parse(
			lateSocket.send.mock.calls[0][0] as string
		);
		expect(received.photo.id).toBe('second');
	});
});

describe('realtime broadcast — broadcastToGallery delivers to all connected clients', () => {
	it('routes photo:new through the DO namespace to both connected sockets', async () => {
		const socket1 = makeSocket();
		const socket2 = makeSocket();
		const { room } = makeRoom([socket1, socket2]);

		const gallery = makeGalleryBinding(room);
		const photo = {
			id: 'xyz',
			url: 'https://cdn.example.com/photos/xyz.jpg',
			name: 'Concert Night',
			createdAt: 1_700_000_002_000
		};
		await broadcastToGallery(gallery as never, { type: 'photo:new', photo });

		const payload = JSON.stringify({ type: 'photo:new', photo });
		expect(socket1.send).toHaveBeenCalledWith(payload);
		expect(socket2.send).toHaveBeenCalledWith(payload);
	});

	it('completes without error when no clients are connected', async () => {
		const { room } = makeRoom([]);
		const gallery = makeGalleryBinding(room);
		await expect(broadcastToGallery(gallery as never, photoMessage())).resolves.toBeUndefined();
	});
});
