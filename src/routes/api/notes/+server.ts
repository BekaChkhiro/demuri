import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireEnv } from '$lib/server/env';
import {
	insertNote,
	listNotes,
	sanitizeNoteText,
	toNoteResponse,
	type NoteResponse
} from '$lib/server/notes';
import type { RequestHandler } from './$types';

/** Matches the client-side compression cap. */
const MAX_BYTES = 8 * 1024 * 1024;

/** GET /api/notes — latest notes, newest-first. */
export const GET: RequestHandler = async ({ platform }) => {
	const db = getDb(platform);
	const publicBase = requireEnv(platform, 'R2_PUBLIC_BASE_URL');
	const notes = await listNotes(db, publicBase);
	return json({ notes });
};

/**
 * POST /api/notes — multipart/form-data with a required `photo` File and a
 * required `text`. Stores the blob in R2 and persists a row in D1.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform);
	const bucket = requireEnv(platform, 'PHOTOS_BUCKET');
	const publicBase = requireEnv(platform, 'R2_PUBLIC_BASE_URL');

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		throw error(400, 'მოსალოდნელი იყო multipart/form-data');
	}

	const photo = form.get('photo');
	if (!(photo instanceof File)) {
		throw error(400, 'ფოტოს ფაილი არ მოიძებნა');
	}
	if (!photo.type.startsWith('image/')) {
		throw error(400, 'ატვირთული ფაილი უნდა იყოს სურათი');
	}
	if (photo.size === 0) {
		throw error(400, 'ატვირთული ფაილი ცარიელია');
	}
	if (photo.size > MAX_BYTES) {
		throw error(400, 'ატვირთული ფაილი აჭარბებს 8MB ლიმიტს');
	}

	const text = sanitizeNoteText(form.get('text'));
	if (text.length === 0) {
		throw error(400, 'ტექსტი სავალდებულოა');
	}

	const id = crypto.randomUUID();
	const r2Key = `notes/${id}.jpg`;
	const createdAt = Date.now();

	const bytes = await photo.arrayBuffer();
	await bucket.put(r2Key, bytes, { httpMetadata: { contentType: photo.type } });

	const row = { id, r2_key: r2Key, text, created_at: createdAt };
	await insertNote(db, row);

	const body: NoteResponse = toNoteResponse(row, publicBase);
	return json(body, { status: 201 });
};
