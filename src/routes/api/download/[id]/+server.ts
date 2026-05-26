import { error } from '@sveltejs/kit';
import { requireEnv } from '$lib/server/env';
import type { RequestHandler } from './$types';

/**
 * GET /api/download/:id
 *
 * Streams a photo's bytes from R2 from the SAME origin, with a
 * Content-Disposition: attachment header so the browser saves it directly.
 * Going through the Worker avoids the cross-origin CORS limits of the public
 * r2.dev URL, which broke client-side download/share-with-file.
 *
 * Keys are derived from a UUID at upload time (`photos/<id>.jpg`), so the id
 * alone resolves the object — no DB lookup needed.
 */
export const GET: RequestHandler = async ({ params, platform }) => {
	const id = params.id;
	if (!/^[0-9a-f-]{36}$/i.test(id)) {
		throw error(400, 'Invalid id');
	}

	const bucket = requireEnv(platform, 'PHOTOS_BUCKET');
	const object = await bucket.get(`photos/${id}.jpg`);
	if (!object) {
		throw error(404, 'Not found');
	}

	const headers = new Headers();
	headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/jpeg');
	headers.set('Content-Disposition', `attachment; filename="bolozari-${id}.jpg"`);
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');

	return new Response(await object.arrayBuffer(), { headers });
};
