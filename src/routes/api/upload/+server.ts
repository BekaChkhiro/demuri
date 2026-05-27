import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireEnv } from '$lib/server/env';
import { GALLERY_ROOM_NAME } from '$lib/server/gallery-room-name';
import { BROADCAST_PATH } from '$lib/server/GalleryRoom';
import { insertPhoto, publicUrl, sanitizeName, type PhotoResponse } from '$lib/server/photos';
import type { RequestHandler } from './$types';

/** Maximum accepted upload size — headroom for high-quality (2560–3000px) JPEGs. */
const MAX_BYTES = 12 * 1024 * 1024;

/**
 * POST /api/upload
 *
 * Accepts a multipart/form-data body with a required `photo` File and an
 * optional `name`. Validates the content type and size, stores the blob in R2
 * under a server-generated key, persists a metadata row in D1, and returns the
 * created record with its public URL.
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
		throw error(400, 'ატვირთული ფაილი აჭარბებს 12MB ლიმიტს');
	}

	const name = sanitizeName(form.get('name'));
	const id = crypto.randomUUID();
	// Never trust the client filename — derive the key from a fresh UUID.
	const r2Key = `photos/${id}.jpg`;
	const createdAt = Date.now();

	const bytes = await photo.arrayBuffer();
	await bucket.put(r2Key, bytes, {
		httpMetadata: { contentType: photo.type }
	});

	await insertPhoto(db, { id, r2_key: r2Key, name, created_at: createdAt });

	const body: PhotoResponse = {
		id,
		url: publicUrl(publicBase, r2Key),
		name,
		createdAt
	};

	// Notify live clients — broadcast failure must not fail the upload.
	try {
		const gallery = requireEnv(platform, 'GALLERY');
		const stub = gallery.get(gallery.idFromName(GALLERY_ROOM_NAME));
		await stub.fetch(`https://do${BROADCAST_PATH}`, {
			method: 'POST',
			body: JSON.stringify({ type: 'photo:new', photo: body })
		} as never);
	} catch {
		// Best-effort: no connected clients or DO unavailable.
	}

	return json(body, { status: 201 });
};
