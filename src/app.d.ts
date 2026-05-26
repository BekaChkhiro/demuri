// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { D1Database, R2Bucket, DurableObjectNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				/** D1 database for photo metadata (T1.3). */
				DB: D1Database;
				/** R2 bucket for uploaded photo blobs (T1.2). */
				PHOTOS_BUCKET: R2Bucket;
				/** Durable Object for live gallery state — implemented in Phase 3. */
				GALLERY: DurableObjectNamespace;
				/** Admin password, supplied as a secret (.dev.vars locally). */
				ADMIN_PASSWORD: string;
				/** Public base URL for serving R2 objects. */
				R2_PUBLIC_BASE_URL: string;
			};
		}
	}
}

export {};
