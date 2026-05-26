import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server';

function makePlatform() {
	const stubResponse = { status: 101, marker: 'from-do' };
	const stub = { fetch: vi.fn().mockResolvedValue(stubResponse) };
	const id = { toString: () => 'gallery-id' };
	const idFromName = vi.fn().mockReturnValue(id);
	const get = vi.fn().mockReturnValue(stub);

	const platform = {
		env: {
			GALLERY: { idFromName, get }
		}
	} as unknown as App.Platform;

	return { platform, idFromName, get, stub, stubResponse, id };
}

function upgradeRequest(headers: Record<string, string> = { upgrade: 'websocket' }) {
	return new Request('http://localhost/api/ws', { headers });
}

describe('GET /api/ws', () => {
	it('rejects a plain request without an Upgrade: websocket header (426)', async () => {
		const { platform } = makePlatform();
		await expect(
			GET({ request: new Request('http://localhost/api/ws'), platform } as never)
		).rejects.toMatchObject({ status: 426 });
	});

	it('forwards an upgrade to the single GALLERY Durable Object and returns its response', async () => {
		const { platform, idFromName, get, stub, stubResponse, id } = makePlatform();

		const res = await GET({ request: upgradeRequest(), platform } as never);

		expect(idFromName).toHaveBeenCalledOnce();
		expect(get).toHaveBeenCalledWith(id);
		expect(stub.fetch).toHaveBeenCalledOnce();
		expect(res).toBe(stubResponse);
	});

	it('treats a mixed-case Upgrade header as a valid upgrade', async () => {
		const { platform, stub } = makePlatform();
		await GET({ request: upgradeRequest({ upgrade: 'WebSocket' }), platform } as never);
		expect(stub.fetch).toHaveBeenCalledOnce();
	});
});
