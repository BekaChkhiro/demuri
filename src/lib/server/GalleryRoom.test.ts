import { describe, it, expect, vi, afterEach } from 'vitest';
import { GalleryRoom, BROADCAST_PATH } from './GalleryRoom';

/** Build a fake DurableObjectState with controllable socket bookkeeping. */
function makeState(sockets: Array<{ send: ReturnType<typeof vi.fn> }> = []) {
	return {
		acceptWebSocket: vi.fn(),
		getWebSockets: vi.fn().mockReturnValue(sockets)
	};
}

function makeRoom(state: ReturnType<typeof makeState>) {
	return new GalleryRoom(state as never, {} as never);
}

function broadcastRequest(message: unknown) {
	return new Request(`https://gallery.internal${BROADCAST_PATH}`, {
		method: 'POST',
		body: JSON.stringify(message)
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GalleryRoom.fetch — routing', () => {
	it('returns 426 when the request is neither a broadcast nor an upgrade', async () => {
		const room = makeRoom(makeState());
		const res = await room.fetch(new Request('https://gallery.internal/'));
		expect(res.status).toBe(426);
	});
});

describe('GalleryRoom — WebSocket upgrade', () => {
	it('accepts the server socket and returns 101 with the client socket', async () => {
		const client = { id: 'client' };
		const server = { id: 'server' };
		const FakePair = vi.fn(function () {
			return { 0: client, 1: server };
		});
		const captured: Array<{ body: unknown; init: ResponseInit }> = [];
		const FakeResponse = vi.fn(function (body: unknown, init: ResponseInit) {
			captured.push({ body, init });
			return { status: init?.status ?? 200, init };
		});
		vi.stubGlobal('WebSocketPair', FakePair);
		vi.stubGlobal('Response', FakeResponse);

		const state = makeState();
		const room = makeRoom(state);
		const res = (await room.fetch(
			new Request('https://gallery.internal/api/ws', {
				headers: { upgrade: 'websocket' }
			})
		)) as unknown as { status: number };

		expect(state.acceptWebSocket).toHaveBeenCalledOnce();
		expect(state.acceptWebSocket).toHaveBeenCalledWith(server);
		expect(res.status).toBe(101);
		expect(captured[0].init).toMatchObject({ status: 101, webSocket: client });
	});
});

describe('GalleryRoom — broadcast', () => {
	it('sends the payload to every live socket and reports the count', async () => {
		const sockets = [{ send: vi.fn() }, { send: vi.fn() }, { send: vi.fn() }];
		const room = makeRoom(makeState(sockets));

		const message = { type: 'photo:new', photo: { id: 'abc' } };
		const res = await room.fetch(broadcastRequest(message));

		const serialized = JSON.stringify(message);
		for (const socket of sockets) {
			expect(socket.send).toHaveBeenCalledOnce();
			expect(socket.send).toHaveBeenCalledWith(serialized);
		}
		expect(await res.json()).toEqual({ delivered: 3 });
	});

	it('skips sockets that throw on send and still delivers to the rest', async () => {
		const good1 = { send: vi.fn() };
		const bad = {
			send: vi.fn(() => {
				throw new Error('socket closing');
			})
		};
		const good2 = { send: vi.fn() };
		const room = makeRoom(makeState([good1, bad, good2]));

		const res = await room.fetch(broadcastRequest({ type: 'photo:new' }));

		expect(good1.send).toHaveBeenCalledOnce();
		expect(good2.send).toHaveBeenCalledOnce();
		expect(await res.json()).toEqual({ delivered: 2 });
	});

	it('delivers to nobody when there are no connections', async () => {
		const room = makeRoom(makeState([]));
		const res = await room.fetch(broadcastRequest({ type: 'photo:new' }));
		expect(await res.json()).toEqual({ delivered: 0 });
	});
});

describe('GalleryRoom — hibernation close handler', () => {
	it('closes our half of the socket with the client-supplied code', async () => {
		const ws = { close: vi.fn() };
		const room = makeRoom(makeState());
		await room.webSocketClose(ws as never, 1001);
		expect(ws.close).toHaveBeenCalledWith(1001);
	});

	it('substitutes 1000 for the non-echoable abnormal-close code 1006', async () => {
		const ws = { close: vi.fn() };
		const room = makeRoom(makeState());
		await room.webSocketClose(ws as never, 1006);
		expect(ws.close).toHaveBeenCalledWith(1000);
	});

	it('swallows errors thrown while closing an already-closing socket', async () => {
		const ws = {
			close: vi.fn(() => {
				throw new Error('already closed');
			})
		};
		const room = makeRoom(makeState());
		await expect(room.webSocketClose(ws as never, 1001)).resolves.toBeUndefined();
	});
});
