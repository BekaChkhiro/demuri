import { describe, it, expect, vi } from 'vitest';
import { GET } from './+server';
import type { Photo } from '$lib/server/db';
import { MAX_LIMIT } from '$lib/server/photos';

function makePhotoRow(n: number): Photo {
	return {
		id: `id-${n}`,
		r2_key: `photos/id-${n}.jpg`,
		name: `Photo ${n}`,
		created_at: 1_700_000_000_000 - n * 1000,
		hidden: 0
	};
}

function makeD1(rows: Photo[] = []) {
	const all = vi.fn().mockResolvedValue({ results: rows });
	const bind = vi.fn().mockReturnValue({ all });
	const stmt = { bind };
	const prepare = vi.fn().mockReturnValue(stmt);
	return { prepare } as unknown as import('@cloudflare/workers-types').D1Database;
}

function makePlatform(rows: Photo[] = []) {
	return {
		env: {
			DB: makeD1(rows),
			R2_PUBLIC_BASE_URL: 'https://cdn.example.com'
		}
	} as unknown as App.Platform;
}

function makeEvent(params: Record<string, string> = {}, rows: Photo[] = []) {
	const url = new URL('http://localhost/api/photos');
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}
	return { url, platform: makePlatform(rows) } as never;
}

describe('GET /api/photos', () => {
	it('returns 200 with an empty list when there are no photos', async () => {
		const response = await GET(makeEvent());
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.photos).toHaveLength(0);
		expect(body.nextBefore).toBeNull();
	});

	it('returns photos with correctly prefixed public URLs', async () => {
		const response = await GET(makeEvent({}, [makePhotoRow(1)]));
		const body = await response.json();
		expect(body.photos[0].url).toContain('https://cdn.example.com/photos/');
	});

	it('returns 400 for a non-numeric before param', async () => {
		await expect(GET(makeEvent({ before: 'abc' }))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 for before=0', async () => {
		await expect(GET(makeEvent({ before: '0' }))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 for a negative before param', async () => {
		await expect(GET(makeEvent({ before: '-100' }))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 for a non-integer limit (float)', async () => {
		await expect(GET(makeEvent({ limit: '5.5' }))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 for limit=0', async () => {
		await expect(GET(makeEvent({ limit: '0' }))).rejects.toMatchObject({ status: 400 });
	});

	it('returns 400 for limit exceeding MAX_LIMIT', async () => {
		await expect(GET(makeEvent({ limit: String(MAX_LIMIT + 1) }))).rejects.toMatchObject({
			status: 400
		});
	});

	it('accepts the maximum allowed limit without error', async () => {
		const response = await GET(makeEvent({ limit: String(MAX_LIMIT) }, []));
		expect(response.status).toBe(200);
	});

	it('accepts a valid before cursor without error', async () => {
		const response = await GET(makeEvent({ before: '1700000000000' }, []));
		expect(response.status).toBe(200);
	});

	it('passes a pagination cursor back when more photos exist', async () => {
		// Request 2 photos; provide 3 rows so listPhotos detects a next page
		const rows = [makePhotoRow(1), makePhotoRow(2), makePhotoRow(3)];
		const response = await GET(makeEvent({ limit: '2' }, rows));
		const body = await response.json();
		expect(body.photos).toHaveLength(2);
		expect(body.nextBefore).toBe(rows[2].created_at);
	});
});
