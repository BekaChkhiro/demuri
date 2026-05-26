import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import { BROADCAST_PATH } from './GalleryRoom';
import { GALLERY_ROOM_NAME } from './gallery-room-name';

/**
 * Fan a message out to every client connected to the shared gallery room.
 *
 * Resolves the single GalleryRoom DO and POSTs the serialized payload to its
 * internal `/broadcast` entrypoint. Trusted server code only — the broadcast
 * path is never exposed on the public router.
 *
 * The `url` host is irrelevant (the request is routed by the DO stub, not the
 * network); only the pathname is used to dispatch inside the DO.
 */
export async function broadcastToGallery(
	gallery: DurableObjectNamespace,
	message: unknown
): Promise<void> {
	const id = gallery.idFromName(GALLERY_ROOM_NAME);
	const stub = gallery.get(id);
	await stub.fetch(`https://gallery.internal${BROADCAST_PATH}`, {
		method: 'POST',
		body: JSON.stringify(message)
	});
}
