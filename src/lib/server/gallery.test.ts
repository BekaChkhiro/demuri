import { describe, it, expect, vi } from 'vitest';
import { broadcastToGallery } from './gallery';
import { BROADCAST_PATH } from './GalleryRoom';
import { GALLERY_ROOM_NAME } from './gallery-room-name';

function makeGallery() {
	const id = { toString: () => 'gallery-id' };
	const stub = { fetch: vi.fn().mockResolvedValue(new Response(null)) };
	const idFromName = vi.fn().mockReturnValue(id);
	const get = vi.fn().mockReturnValue(stub);
	return { gallery: { idFromName, get }, idFromName, get, stub, id };
}

describe('broadcastToGallery', () => {
	it('resolves the single room DO and POSTs the serialized message to /broadcast', async () => {
		const { gallery, idFromName, get, stub, id } = makeGallery();
		const message = { type: 'photo:new', photo: { id: 'abc', url: 'https://x/y.jpg' } };

		await broadcastToGallery(gallery as never, message);

		expect(idFromName).toHaveBeenCalledWith(GALLERY_ROOM_NAME);
		expect(get).toHaveBeenCalledWith(id);

		expect(stub.fetch).toHaveBeenCalledOnce();
		const [url, init] = stub.fetch.mock.calls[0];
		expect(String(url)).toContain(BROADCAST_PATH);
		expect(init.method).toBe('POST');
		expect(init.body).toBe(JSON.stringify(message));
	});
});
