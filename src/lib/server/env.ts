/**
 * Single typed accessor for Cloudflare platform bindings.
 *
 * Server code should read env exclusively through `getEnv` (or the
 * binding-specific helpers) rather than reaching into `platform.env`
 * directly. Bindings are typed in `src/app.d.ts`.
 */

/** All bindings available on `platform.env`, typed in `src/app.d.ts`. */
export type Env = NonNullable<App.Platform['env']>;

/**
 * Resolve the bindings object from the SvelteKit request platform.
 * Throws if unavailable (e.g. outside the Workers runtime).
 */
export function getEnv(platform: App.Platform | undefined): Env {
	const env = platform?.env;
	if (!env) {
		throw new Error('platform.env is not available (not running in the Workers runtime?)');
	}
	return env;
}

/**
 * Read a single binding, throwing a clear error when it is missing.
 * Use for secrets/vars that must be present before proceeding.
 */
export function requireEnv<K extends keyof Env>(platform: App.Platform | undefined, key: K): Env[K] {
	const value = getEnv(platform)[key];
	if (value == null) {
		throw new Error(`Required binding \`${String(key)}\` is not available on platform.env`);
	}
	return value;
}
