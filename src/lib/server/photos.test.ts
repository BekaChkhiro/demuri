import { describe, it, expect, vi } from 'vitest';
import {
	sanitizeName,
	publicUrl,
	toPhotoResponse,
	insertPhoto,
	listPhotos,
	MAX_NAME_LENGTH,
	MAX_LIMIT,
	DEFAULT_LIMIT
} from './photos';
import type { Photo } from './db';
import type { D1Database } from '@cloudflare/workers-types';

function makeD1(rows: Photo[] = []) {
	const all = vi.fn().mockResolvedValue({ results: rows });
	const run = vi.fn().mockResolvedValue({ success: true });
	const boundStmt = { all, run };
	const bind = vi.fn().mockReturnValue(boundStmt);
	const stmt = { bind };
	const prepare = vi.fn().mockReturnValue(stmt);
	const db = { prepare } as unknown as D1Database;
	return { db, stmt, all, run };
}

function makePhotoRow(n: number): Photo {
	return {
		id: `id-${n}`,
		r2_key: `photos/id-${n}.jpg`,
		name: `Photo ${n}`,
		created_at: 1_700_000_000_000 - n * 1000,
		hidden: 0
	};
}

const BASE = 'https://cdn.example.com';

describe('sanitizeName', () => {
	it('returns null for null input', () => {
		expect(sanitizeName(null)).toBeNull();
	});

	it('returns null for a File (non-string FormDataEntryValue)', () => {
		const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
		expect(sanitizeName(file)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(sanitizeName('')).toBeNull();
	});

	it('returns null for whitespace-only string', () => {
		expect(sanitizeName('   ')).toBeNull();
	});

	it('strips ASCII control characters', () => {
		expect(sanitizeName('hello\x00world')).toBe('helloworld');
		expect(sanitizeName('foo\x1fbar')).toBe('foobar');
		expect(sanitizeName('tab\ttab')).toBe('tabtab');
	});

	it('strips DEL (0x7f)', () => {
		expect(sanitizeName('del\x7fchar')).toBe('delchar');
	});

	it('trims surrounding whitespace', () => {
		expect(sanitizeName('  hello  ')).toBe('hello');
	});

	it('truncates to MAX_NAME_LENGTH', () => {
		const long = 'a'.repeat(MAX_NAME_LENGTH + 10);
		expect(sanitizeName(long)).toHaveLength(MAX_NAME_LENGTH);
	});

	it('returns the original value for a short valid name', () => {
		expect(sanitizeName('Alice')).toBe('Alice');
	});

	it('preserves non-ASCII characters', () => {
		expect(sanitizeName('Güz')).toBe('Güz');
	});
});

describe('publicUrl', () => {
	it('concatenates base and key with a slash', () => {
		expect(publicUrl('https://cdn.example.com', 'photos/abc.jpg')).toBe(
			'https://cdn.example.com/photos/abc.jpg'
		);
	});

	it('strips a single trailing slash from base', () => {
		expect(publicUrl('https://cdn.example.com/', 'photos/abc.jpg')).toBe(
			'https://cdn.example.com/photos/abc.jpg'
		);
	});

	it('strips multiple trailing slashes from base', () => {
		expect(publicUrl('https://cdn.example.com///', 'photos/abc.jpg')).toBe(
			'https://cdn.example.com/photos/abc.jpg'
		);
	});
});

describe('toPhotoResponse', () => {
	it('maps a Photo row to the correct PhotoResponse shape', () => {
		const photo: Photo = {
			id: 'uuid-1',
			r2_key: 'photos/uuid-1.jpg',
			name: 'Sunset',
			created_at: 1_700_000_000_000,
			hidden: 0
		};
		expect(toPhotoResponse(photo, BASE)).toEqual({
			id: 'uuid-1',
			url: `${BASE}/photos/uuid-1.jpg`,
			name: 'Sunset',
			createdAt: 1_700_000_000_000
		});
	});

	it('propagates null name', () => {
		const photo: Photo = {
			id: 'uuid-2',
			r2_key: 'photos/uuid-2.jpg',
			name: null,
			created_at: 1_700_000_000_001,
			hidden: 0
		};
		expect(toPhotoResponse(photo, BASE).name).toBeNull();
	});
});

describe('insertPhoto', () => {
	it('executes an INSERT with the correct bound values', async () => {
		const { db, stmt, run } = makeD1();
		await insertPhoto(db, { id: 'abc', r2_key: 'photos/abc.jpg', name: 'Test', created_at: 123 });
		expect(stmt.bind).toHaveBeenCalledWith('abc', 'photos/abc.jpg', 'Test', 123);
		expect(run).toHaveBeenCalled();
	});

	it('accepts null name', async () => {
		const { db, stmt } = makeD1();
		await insertPhoto(db, { id: 'xyz', r2_key: 'photos/xyz.jpg', name: null, created_at: 1 });
		expect(stmt.bind).toHaveBeenCalledWith('xyz', 'photos/xyz.jpg', null, 1);
	});
});

describe('listPhotos', () => {
	it('returns an empty list when there are no rows', async () => {
		const { db } = makeD1([]);
		const result = await listPhotos(db, BASE, null, DEFAULT_LIMIT);
		expect(result.photos).toHaveLength(0);
		expect(result.nextBefore).toBeNull();
	});

	it('returns all rows and null nextBefore when result count is below limit', async () => {
		const rows = [makePhotoRow(1), makePhotoRow(2)];
		const { db } = makeD1(rows);
		const result = await listPhotos(db, BASE, null, 5);
		expect(result.photos).toHaveLength(2);
		expect(result.nextBefore).toBeNull();
	});

	it('sets nextBefore when the DB returns more rows than the requested limit', async () => {
		// listPhotos fetches limit+1 internally to detect a next page
		const rows = [makePhotoRow(1), makePhotoRow(2), makePhotoRow(3)];
		const { db } = makeD1(rows);
		const result = await listPhotos(db, BASE, null, 2);
		expect(result.photos).toHaveLength(2);
		expect(result.nextBefore).toBe(rows[2].created_at);
	});

	it('clamps limit to MAX_LIMIT', async () => {
		const rows = Array.from({ length: MAX_LIMIT + 1 }, (_, i) => makePhotoRow(i));
		const { db } = makeD1(rows);
		const result = await listPhotos(db, BASE, null, MAX_LIMIT + 100);
		expect(result.photos).toHaveLength(MAX_LIMIT);
		expect(result.nextBefore).not.toBeNull();
	});

	it('passes the before cursor to bind() when provided', async () => {
		const { db, stmt } = makeD1([]);
		const cursor = 1_700_000_000_000;
		await listPhotos(db, BASE, cursor, DEFAULT_LIMIT);
		expect(stmt.bind).toHaveBeenCalledWith(cursor, expect.any(Number));
	});

	it('does not pass before to bind() when cursor is null', async () => {
		const { db, stmt } = makeD1([]);
		await listPhotos(db, BASE, null, DEFAULT_LIMIT);
		// Without cursor, only fetchLimit is bound
		expect(stmt.bind).toHaveBeenCalledWith(expect.any(Number));
		expect(stmt.bind).not.toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
	});

	it('maps rows to the correct public URL', async () => {
		const rows = [makePhotoRow(1)];
		const { db } = makeD1(rows);
		const result = await listPhotos(db, BASE, null, DEFAULT_LIMIT);
		expect(result.photos[0].url).toBe(`${BASE}/${rows[0].r2_key}`);
	});
});
