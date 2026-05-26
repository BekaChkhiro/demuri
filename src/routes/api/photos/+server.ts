import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireEnv } from '$lib/server/env';
import { listPhotos, DEFAULT_LIMIT, MAX_LIMIT } from '$lib/server/photos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform);
	const publicBase = requireEnv(platform, 'R2_PUBLIC_BASE_URL');

	const beforeParam = url.searchParams.get('before');
	const limitParam = url.searchParams.get('limit');

	let before: number | null = null;
	if (beforeParam !== null) {
		const parsed = Number(beforeParam);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			throw error(400, 'Invalid before param: must be a positive number');
		}
		before = parsed;
	}

	let limit = DEFAULT_LIMIT;
	if (limitParam !== null) {
		const parsed = Number(limitParam);
		if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_LIMIT) {
			throw error(400, `Invalid limit param: must be an integer between 1 and ${MAX_LIMIT}`);
		}
		limit = parsed;
	}

	const result = await listPhotos(db, publicBase, before, limit);
	return json(result);
};
