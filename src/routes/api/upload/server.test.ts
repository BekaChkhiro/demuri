import { describe, it, expect, vi } from 'vitest';
import { POST } from './+server';

function makePlatform() {
	const run = vi.fn().mockResolvedValue({ success: true });
	const boundStmt = { run };
	const bind = vi.fn().mockReturnValue(boundStmt);
	const stmt = { bind };
	const prepare = vi.fn().mockReturnValue(stmt);
	const db = { prepare };

	const bucket = { put: vi.fn().mockResolvedValue(undefined) };

	const doFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ delivered: 0 })));
	const doStub = { fetch: doFetch };
	const doId = {};
	const idFromName = vi.fn().mockReturnValue(doId);
	const doGet = vi.fn().mockReturnValue(doStub);
	const gallery = { idFromName, get: doGet };

	const platform = {
		env: {
			DB: db,
			PHOTOS_BUCKET: bucket,
			R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
			GALLERY: gallery
		}
	} as unknown as App.Platform;

	return { platform, doFetch, idFromName, doGet };
}

function makeImageFile(sizeBytes = 1024, type = 'image/jpeg') {
	return new File([new Uint8Array(sizeBytes)], 'test.jpg', { type });
}

function makeRequest(fields: { photo?: File | null; name?: string } = {}) {
	const form = new FormData();
	if (fields.photo !== undefined && fields.photo !== null) {
		form.append('photo', fields.photo);
	}
	if (fields.name !== undefined) {
		form.append('name', fields.name);
	}
	return new Request('http://localhost/api/upload', { method: 'POST', body: form });
}

describe('POST /api/upload', () => {
	it('returns 400 when the photo field is missing', async () => {
		await expect(
			POST({ request: makeRequest({}), platform: makePlatform().platform } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when the uploaded file is not an image', async () => {
		const file = new File(['hello'], 'document.pdf', { type: 'application/pdf' });
		await expect(
			POST({ request: makeRequest({ photo: file }), platform: makePlatform().platform } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when the file is empty (0 bytes)', async () => {
		const file = new File([], 'empty.jpg', { type: 'image/jpeg' });
		await expect(
			POST({ request: makeRequest({ photo: file }), platform: makePlatform().platform } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 when the file exceeds the 12 MB limit', async () => {
		const file = new File([new Uint8Array(13 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
		await expect(
			POST({ request: makeRequest({ photo: file }), platform: makePlatform().platform } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns 201 with a well-formed PhotoResponse on a valid upload', async () => {
		const { platform } = makePlatform();
		const response = await POST({
			request: makeRequest({ photo: makeImageFile(), name: 'Beach Sunset' }),
			platform
		} as never);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toMatchObject({
			id: expect.any(String),
			url: expect.stringContaining('https://cdn.example.com/photos/'),
			name: 'Beach Sunset',
			createdAt: expect.any(Number)
		});
	});

	it('returns null name when the name field is omitted', async () => {
		const { platform } = makePlatform();
		const response = await POST({
			request: makeRequest({ photo: makeImageFile() }),
			platform
		} as never);
		const body = await response.json();
		expect(body.name).toBeNull();
	});

	it('sanitizes the name field before returning', async () => {
		const { platform } = makePlatform();
		const response = await POST({
			request: makeRequest({ photo: makeImageFile(), name: '  Trimmed  ' }),
			platform
		} as never);
		const body = await response.json();
		expect(body.name).toBe('Trimmed');
	});

	it('calls R2 bucket.put once with a key under the photos/ prefix', async () => {
		const { platform } = makePlatform();
		await POST({ request: makeRequest({ photo: makeImageFile() }), platform } as never);
		expect(platform.env!.PHOTOS_BUCKET.put).toHaveBeenCalledOnce();
		const [key] = (platform.env!.PHOTOS_BUCKET.put as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(key).toMatch(/^photos\//);
	});

	it('accepts image/png in addition to image/jpeg', async () => {
		const { platform } = makePlatform();
		const png = new File([new Uint8Array(512)], 'test.png', { type: 'image/png' });
		const response = await POST({ request: makeRequest({ photo: png }), platform } as never);
		expect(response.status).toBe(201);
	});

	it('broadcasts a photo:new message to the gallery DO after a successful upload', async () => {
		const { platform, doFetch, idFromName } = makePlatform();
		const response = await POST({
			request: makeRequest({ photo: makeImageFile(), name: 'Live Test' }),
			platform
		} as never);

		expect(response.status).toBe(201);
		expect(idFromName).toHaveBeenCalledWith('gallery');
		expect(doFetch).toHaveBeenCalledOnce();

		const [url, init] = (doFetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toContain('/broadcast');
		expect(init.method).toBe('POST');

		const broadcastBody = JSON.parse(init.body);
		expect(broadcastBody).toMatchObject({
			type: 'photo:new',
			photo: expect.objectContaining({
				id: expect.any(String),
				url: expect.stringContaining('https://cdn.example.com/photos/'),
				name: 'Live Test',
				createdAt: expect.any(Number)
			})
		});
	});

	it('still returns 201 even when the gallery broadcast fails', async () => {
		const { platform, doFetch } = makePlatform();
		doFetch.mockRejectedValueOnce(new Error('DO unavailable'));

		const response = await POST({
			request: makeRequest({ photo: makeImageFile() }),
			platform
		} as never);

		expect(response.status).toBe(201);
	});
});
