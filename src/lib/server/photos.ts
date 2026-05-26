import type { D1Database } from '@cloudflare/workers-types';
import type { Photo } from './db';

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
