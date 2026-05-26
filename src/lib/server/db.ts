import type { D1Database } from '@cloudflare/workers-types';

/** A row in the `photos` table. Timestamps are epoch millis. */
export interface Photo {
	id: string;
	r2_key: string;
	name: string | null;
	created_at: number;
	hidden: number;
}

/**
 * Resolve the D1 binding from the SvelteKit request platform.
 * Throws if the binding is missing (e.g. outside the Workers runtime).
 */
export function getDb(platform: App.Platform | undefined): D1Database {
	const db = platform?.env?.DB;
	if (!db) {
		throw new Error('D1 binding `DB` is not available on platform.env');
	}
	return db;
}
