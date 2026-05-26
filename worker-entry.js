// Deploy entry-point for `wrangler deploy` (wired via `main` in wrangler.toml).
//
// @sveltejs/adapter-cloudflare emits .svelte-kit/cloudflare/_worker.js, which
// exports ONLY the SvelteKit fetch handler as `default`. It does not re-export
// our GalleryRoom Durable Object, so deploying _worker.js directly fails with:
//   "Your Worker depends on the following Durable Objects, which are not
//    exported in your entrypoint file: GalleryRoom."
//
// This thin wrapper re-exports the SvelteKit handler plus the DO class, so a
// single Worker satisfies the GALLERY binding declared in wrangler.toml. The
// app reaches the DO through `env.GALLERY` (a binding stub), never by importing
// the class — exporting it here is all the runtime needs.
//
// Lives at the repo root (not under src/) so svelte-check, whose tsconfig is
// scoped to src/, never tries to type-check the post-build _worker.js import.
export { default } from './.svelte-kit/cloudflare/_worker.js';
export { GalleryRoom } from './src/lib/server/GalleryRoom';
