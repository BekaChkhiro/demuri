import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireEnv } from '$lib/server/env';
import { BROADCAST_PATH } from '$lib/server/GalleryRoom';
import { GALLERY_ROOM_NAME } from '$lib/server/gallery-room-name';
import { getPhotoById, setPhotoHidden, deletePhotoRow } from '$lib/server/photos';
import type { RequestHandler } from './$types';

async function broadcastRemove(platform: App.Platform | undefined, id: string): Promise<void> {
	try {
		const gallery = requireEnv(platform, 'GALLERY');
		const stub = gallery.get(gallery.idFromName(GALLERY_ROOM_NAME));
		await stub.fetch(`https://do${BROADCAST_PATH}`, {
			method: 'POST',
			body: JSON.stringify({ type: 'photo:remove', id })
		} as never);
	} catch {
		// Best-effort: no connected clients or DO unavailable.
	}
}

/**
 * PATCH /api/admin/photos/:id
 *
 * Body: { hidden: boolean }
 * Sets the hidden flag on the photo. Returns 200 on success, 404 if not found.
 * Auth is enforced by hooks.server.ts for all /api/admin/* routes.
 */
export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	const db = getDb(platform);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Expected JSON body');
	}

	if (typeof body !== 'object' || body === null || typeof (body as Record<string, unknown>).hidden !== 'boolean') {
		throw error(400, 'Body must be { hidden: boolean }');
	}

	const hidden = (body as { hidden: boolean }).hidden;
	const updated = await setPhotoHidden(db, params.id, hidden);

	if (!updated) {
		throw error(404, 'Photo not found');
	}

	if (hidden) {
		await broadcastRemove(platform, params.id);
	}

	return json({ id: params.id, hidden });
};

/**
 * DELETE /api/admin/photos/:id
 *
 * Removes the R2 object first, then the D1 row to avoid orphaned blobs.
 * Returns 200 on success, 404 if not found. Idempotent — a repeat delete
 * after the row is gone returns 404.
 */
export const DELETE: RequestHandler = async ({ params, platform }) => {
	const db = getDb(platform);
	const bucket = requireEnv(platform, 'PHOTOS_BUCKET');

	const photo = await getPhotoById(db, params.id);
	if (!photo) {
		throw error(404, 'Photo not found');
	}

	// Remove from R2 before D1 to avoid orphaned blobs.
	await bucket.delete(photo.r2_key);
	await deletePhotoRow(db, params.id);

	await broadcastRemove(platform, params.id);

	return json({ id: params.id, deleted: true });
};
