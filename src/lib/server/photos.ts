import type { D1Database } from '@cloudflare/workers-types';
import type { Photo } from './db';

export const MAX_LIMIT = 60;
export const DEFAULT_LIMIT = 20;

/** Fields needed to persist a freshly uploaded photo. */
export interface NewPhoto {
	id: string;
	r2_key: string;
	name: string | null;
	created_at: number;
}

/** Max length we store for a client-supplied display name. */
export const MAX_NAME_LENGTH = 80;

/**
 * Normalize a client-supplied name: strip control characters, trim, and cap
 * the length. Returns null for missing or effectively empty names — we never
 * trust the raw value.
 */
export function sanitizeName(raw: FormDataEntryValue | null): string | null {
	if (typeof raw !== 'string') {
		return null;
	}
	// Drop ASCII control characters (incl. newlines/tabs and DEL) before trimming.
	const cleaned = Array.from(raw)
		.filter((ch) => {
			const code = ch.charCodeAt(0);
			return code >= 0x20 && code !== 0x7f;
		})
		.join('')
		.trim();
	if (cleaned.length === 0) {
		return null;
	}
	return cleaned.slice(0, MAX_NAME_LENGTH);
}

/** Build the public URL for a stored R2 object. */
export function publicUrl(base: string, r2_key: string): string {
	return `${base.replace(/\/+$/, '')}/${r2_key}`;
}

/** Insert a new photo metadata row. Rows default to visible (hidden = 0). */
export async function insertPhoto(db: D1Database, photo: NewPhoto): Promise<void> {
	await db
		.prepare('INSERT INTO photos (id, r2_key, name, created_at, hidden) VALUES (?, ?, ?, ?, 0)')
		.bind(photo.id, photo.r2_key, photo.name, photo.created_at)
		.run();
}

/** Shape returned to the client after a successful upload. */
export interface PhotoResponse {
	id: string;
	url: string;
	name: string | null;
	createdAt: number;
}

/** Map a stored photo row to its public-facing response shape. */
export function toPhotoResponse(photo: Photo, base: string): PhotoResponse {
	return {
		id: photo.id,
		url: publicUrl(base, photo.r2_key),
		name: photo.name,
		createdAt: photo.created_at
	};
}

export interface PhotoListResponse {
	photos: PhotoResponse[];
	nextBefore: number | null;
}

/**
 * List non-hidden photos newest-first with cursor pagination.
 * Fetches up to limit rows (clamped to MAX_LIMIT); pass before to continue
 * from a previous page.
 */
export async function listPhotos(
	db: D1Database,
	base: string,
	before: number | null,
	limit: number
): Promise<PhotoListResponse> {
	const clampedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
	const fetchLimit = clampedLimit + 1;

	let rows: Photo[];
	if (before !== null) {
		rows = (
			await db
				.prepare(
					'SELECT * FROM photos WHERE hidden = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?'
				)
				.bind(before, fetchLimit)
				.all<Photo>()
		).results;
	} else {
		rows = (
			await db
				.prepare('SELECT * FROM photos WHERE hidden = 0 ORDER BY created_at DESC LIMIT ?')
				.bind(fetchLimit)
				.all<Photo>()
		).results;
	}

	const hasMore = rows.length > clampedLimit;
	const photos = rows.slice(0, clampedLimit).map((row) => toPhotoResponse(row, base));
	const nextBefore = hasMore ? rows[clampedLimit].created_at : null;

	return { photos, nextBefore };
}
