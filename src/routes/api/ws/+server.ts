import { error } from '@sveltejs/kit';
import { getEnv } from '$lib/server/env';
import { GALLERY_ROOM_NAME } from '$lib/server/gallery-room-name';
import type { RequestHandler } from './$types';

/**
 * GET /api/ws
 *
 * Upgrades the request to a WebSocket and hands it to the single GalleryRoom
 * Durable Object. Every client resolves the same DO instance (one shared room),
 * so a broadcast reaches everyone connected to the gallery.
 */
export const GET: RequestHandler = async ({ request, platform }) => {
	if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
		throw error(426, 'Expected a WebSocket upgrade request');
	}

	const env = getEnv(platform);
	const id = env.GALLERY.idFromName(GALLERY_ROOM_NAME);
	const stub = env.GALLERY.get(id);

	// Forward the upgrade to the DO; it returns the 101 + client socket, which
	// SvelteKit's Cloudflare worker passes straight back to the client. The DO
	// stub speaks the Cloudflare Request/Response types, hence the boundary cast.
	return stub.fetch(request as never) as unknown as Promise<Response>;
};
