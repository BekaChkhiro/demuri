import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireEnv } from '$lib/server/env';
import { publicUrl } from '$lib/server/photos';
import type { Photo } from '$lib/server/db';

export interface AdminPhoto {
	id: string;
	url: string;
	name: string | null;
	createdAt: number;
	hidden: boolean;
}

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform);
	const publicBase = requireEnv(platform, 'R2_PUBLIC_BASE_URL');

	const rows = (
		await db.prepare('SELECT * FROM photos ORDER BY created_at DESC').all<Photo>()
	).results;

	const photos: AdminPhoto[] = rows.map((row) => ({
		id: row.id,
		url: publicUrl(publicBase, row.r2_key),
		name: row.name,
		createdAt: row.created_at,
		hidden: row.hidden === 1
	}));

	return { photos };
};
