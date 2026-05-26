# demuri - Project Plan

*Generated: 2026-05-26*
*Last Updated: 2026-05-26*

## Overview

**Project Name**: demuri

**Description**: QR-accessed event photo wall. Guests scan a QR code, open a web page, take a photo with their camera, and it auto-uploads to a Cloudflare R2 bucket and appears instantly in a shared live gallery alongside everyone else's photos. Dark + neon green design. Built with SvelteKit on Cloudflare, R2 for blobs, D1 for metadata, a Durable Object for realtime WebSocket broadcast, and a password-protected admin panel for moderation.

**Target Users**: Guests at a single event (mobile-first), plus one event host who moderates via an admin panel.

**Project Type**: fullstack

**Status**: Planning (0% complete)

---

## Core Features

The intent this plan must deliver (every feature should map to a task):

- Camera-only photo capture (getUserMedia)
- Client-side image compression before upload
- Auto-upload to Cloudflare R2
- Live realtime shared gallery via WebSocket
- Optional uploader name attached to photo
- Password-protected admin moderation (hide/delete)
- Dark + neon green responsive UI

---

## Non-Goals

What this project deliberately does NOT do (keeps scope honest):

- No user accounts or login for guests
- No gallery upload from device storage (camera only)
- No QR code generation (host already has the QR)
- No multi-event support — single event only
- No native mobile app
- No video capture, photos only
- No social sharing / comments / likes

---

## Success Criteria

What "done" means for the whole project:

- A guest can scan, capture, and see their photo in the gallery within a few seconds
- Other guests' new photos appear live without manual refresh
- Photos persist in R2 and survive page reloads
- Host can hide or delete any photo from the admin panel
- Works smoothly on mobile browsers (iOS Safari + Android Chrome)

---

## Testing Strategy

- **Unit**: image compression helper, R2 key generation, metadata serialization, admin password check.
- **Integration**: upload endpoint (R2 put + D1 insert), photos listing (hidden filter), moderation endpoints (delete from R2 + D1), Durable Object broadcast fan-out.
- **E2E**: capture → upload → appears in own gallery; second client sees the new photo live; host hides/deletes and it disappears for clients.
- **Coverage gate**: endpoints and the compression/key helpers covered; CI runs `pnpm test` and `pnpm build` on every push.

---

## Production Readiness

- **Deploy**: `wrangler deploy` with production R2 bucket, D1 binding, Durable Object migration, and `ADMIN_PASSWORD` secret.
- **Monitoring**: Cloudflare Workers analytics + `wrangler tail` for live logs; log upload failures.
- **Error handling**: reject oversized/non-image uploads, surface friendly capture/permission errors, handle WebSocket disconnects with reconnect.
- **Security**: admin password as a Wrangler secret (never committed); upload size/content-type validation; rate-limit uploads per client.
- **Env**: `R2_PUBLIC_BASE_URL`, `ADMIN_PASSWORD` configured per environment; `.dev.vars` for local, secrets for prod.

---

## Tasks & Implementation Plan

### Phase 1: Scaffold & Infra (Est: 1 day)

**Goal**: Stand up the SvelteKit + Cloudflare project with R2 bucket, D1 schema, and bindings so feature work can begin.

**Exit Criteria**:
- Fresh pnpm install builds and dev server runs
- R2 bucket created with public access and bound in wrangler config
- D1 database created with photos table migrated
- wrangler dev serves the app locally with all bindings resolved

#### T1.1: Scaffold SvelteKit on Cloudflare
- [ ] **Status**: TODO
- **Complexity**: Low
- **Estimated**: 2 hours
- **Dependencies**: None
- **Description**:
  - **Touchpoints**: create package.json; create svelte.config.js; create vite.config.ts; create tsconfig.json; create src/app.html; create src/routes/+layout.svelte; create src/routes/+page.svelte
  - **Contract**: pnpm create svelte@latest (Skeleton, TypeScript); adapter = @sveltejs/adapter-cloudflare; svelte.config.js exports { kit: { adapter: adapter() } }; dev script = vite dev; build script = vite build
  - Initialize a SvelteKit project configured for the Cloudflare Workers runtime
  - Install adapter-cloudflare and wire it into svelte.config.js
  - Establish the base project structure, TypeScript, and a working dev server
  - **Steps**:
  - 1. Run pnpm create svelte with skeleton + TypeScript template
  - 2. Install @sveltejs/adapter-cloudflare and swap it into svelte.config.js
  - 3. Add a minimal +layout.svelte and +page.svelte placeholder
  - 4. Verify pnpm install && pnpm dev serves the placeholder page
  - **Constraints**: Use pnpm (already installed); Do not add any UI styling yet — that is Phase 5; Camera/upload/admin logic is out of scope for this task
  - **Verify**: `pnpm install && pnpm build`

#### T1.2: Create R2 bucket with public access
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 2 hours
- **Dependencies**: T1.1
- **Description**:
  - **Touchpoints**: edit wrangler.toml; create .dev.vars; edit .gitignore
  - **Contract**: R2 bucket `demuri-photos`; public access via r2.dev managed domain (or custom domain); env var `R2_PUBLIC_BASE_URL` = public base; binding name `PHOTOS_BUCKET`
  - Create the R2 bucket that will hold uploaded photo blobs
  - Enable public read access and capture the public base URL
  - Add the R2 binding to wrangler config and the public URL to env
  - **Steps**:
  - 1. `wrangler r2 bucket create demuri-photos`
  - 2. Enable public access (r2.dev) and copy the public base URL
  - 3. Add `[[r2_buckets]]` binding `PHOTOS_BUCKET` to wrangler.toml
  - 4. Add `R2_PUBLIC_BASE_URL` to .dev.vars and ignore .dev.vars in git
  - **Constraints**: Do not commit any account IDs or tokens; bucket name fixed to demuri-photos; single bucket only
  - **Verify**: `wrangler r2 bucket list | grep demuri-photos`
  - **Acceptance Criteria**:
  - Bucket demuri-photos exists and is listed by wrangler
  - A test object uploaded to the bucket is fetchable over its public URL
  - PHOTOS_BUCKET binding and R2_PUBLIC_BASE_URL resolve in wrangler dev

#### T1.3: Create D1 database and photos table
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 2 hours
- **Dependencies**: T1.1
- **Description**:
  - **Touchpoints**: create migrations/0001_init.sql; edit wrangler.toml; create src/lib/server/db.ts
  - **Contract**: table photos(id TEXT PRIMARY KEY, r2_key TEXT NOT NULL, name TEXT, created_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0); index on (hidden, created_at DESC); D1 binding name `DB`
  - Create a D1 database for photo metadata
  - Author the initial migration with the photos table and a listing index
  - Bind D1 as `DB` in wrangler config
  - **Steps**:
  - 1. `wrangler d1 create demuri`
  - 2. Write migrations/0001_init.sql with the photos table and index
  - 3. Add the `[[d1_databases]]` binding `DB` to wrangler.toml
  - 4. Apply migration locally: `wrangler d1 migrations apply demuri --local`
  - **Constraints**: Keep schema minimal — no event/user tables; hidden defaults to 0; timestamps are epoch millis
  - **Verify**: `wrangler d1 execute demuri --local --command "SELECT name FROM sqlite_master WHERE type='table'"`
  - **Acceptance Criteria**:
  - photos table is created by the migration with all specified columns
  - Listing index on (hidden, created_at DESC) exists
  - DB binding resolves and a SELECT runs in wrangler dev

#### T1.4: Wire bindings, env, and local dev
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 2 hours
- **Dependencies**: T1.2, T1.3
- **Description**:
  - **Touchpoints**: edit wrangler.toml; create src/app.d.ts; create .dev.vars; create src/lib/server/env.ts
  - **Contract**: app.d.ts Platform.env types: PHOTOS_BUCKET (R2Bucket), DB (D1Database), GALLERY (DurableObjectNamespace), ADMIN_PASSWORD (string), R2_PUBLIC_BASE_URL (string); accessed via event.platform.env
  - Type all Cloudflare bindings on the SvelteKit platform interface
  - Provide local secrets via .dev.vars and confirm bindings resolve
  - Establish a single typed accessor for platform env in server code
  - **Steps**:
  - 1. Declare App.Platform.env types in src/app.d.ts for all bindings
  - 2. Add ADMIN_PASSWORD and R2_PUBLIC_BASE_URL to .dev.vars
  - 3. Add a thin env helper that reads event.platform.env with type safety
  - 4. Run wrangler dev and confirm all bindings resolve with no errors
  - **Constraints**: GALLERY Durable Object namespace is declared here but implemented in Phase 3; never read secrets on the client
  - **Verify**: `pnpm build && wrangler dev --test-scheduled` (boots with bindings resolved)
  - **Acceptance Criteria**:
  - app.d.ts types cover PHOTOS_BUCKET, DB, GALLERY, ADMIN_PASSWORD, R2_PUBLIC_BASE_URL
  - wrangler dev boots with all bindings resolved and no type errors
  - Server code reads env through the typed accessor only

---

### Phase 2: Capture & Upload Pipeline (Est: 2 days)

**Goal**: Let a guest capture a photo with the camera, compress it client-side, and persist it to R2 + D1 via an upload endpoint.

**Exit Criteria**:
- Camera preview works on mobile and a photo can be captured
- Captured image is compressed/resized before upload
- POST /api/upload stores the blob in R2 and a metadata row in D1
- GET /api/photos returns non-hidden photos with public R2 URLs

#### T2.1: Build camera capture component
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 5 hours
- **Dependencies**: T1.1
- **Description**:
  - **Touchpoints**: create src/lib/components/Camera.svelte; create src/lib/camera.ts; edit src/routes/+page.svelte
  - **Contract**: Camera.svelte uses navigator.mediaDevices.getUserMedia({ video: { facingMode } }); exposes capture(): Promise<Blob> rendering the current frame to a canvas as JPEG; dispatches `capture` event with the Blob; optional name text input bound separately
  - Implement a mobile-first camera preview using getUserMedia
  - Draw the current video frame to a canvas and export a JPEG Blob on capture
  - Handle permission-denied and no-camera states gracefully
  - **Steps**:
  - 1. Request camera stream with rear-facing default and attach to a video element
  - 2. Add a capture button that renders the current frame to a canvas
  - 3. Export the canvas to a JPEG Blob and dispatch it to the page
  - 4. Add permission/error and front/back camera toggle handling
  - **Constraints**: Camera only — no file input fallback; request stream only after a user gesture; stop tracks on unmount to release the camera
  - **Verify**: `pnpm build` and manual capture on a mobile browser produces a JPEG Blob
  - **Acceptance Criteria**:
  - Live camera preview renders on iOS Safari and Android Chrome
  - Capture produces a JPEG Blob of the current frame
  - Permission-denied shows a clear message instead of a blank screen
  - **Test Task**: T2.5

#### T2.2: Client-side image compression
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T2.1
- **Description**:
  - **Touchpoints**: create src/lib/compress.ts; edit src/lib/components/Camera.svelte
  - **Contract**: compressImage(blob: Blob, maxEdge = 1600, quality = 0.82): Promise<Blob>; downscales longest edge to maxEdge via canvas and re-encodes JPEG; returns original if already smaller
  - Resize and re-encode captured photos before upload to cut bandwidth and storage
  - Cap the longest edge and JPEG quality with sensible defaults
  - **Steps**:
  - 1. Load the captured Blob into an Image/ImageBitmap
  - 2. Compute target dimensions capping the longest edge at maxEdge
  - 3. Draw to an offscreen canvas and export JPEG at the configured quality
  - 4. Return the smaller of original vs compressed
  - **Constraints**: Pure client-side, no external libraries unless trivial; preserve aspect ratio; never upscale
  - **Verify**: `pnpm test src/lib/compress` (unit test asserts dimensions and reduced size)
  - **Acceptance Criteria**:
  - A large photo is reduced so its longest edge is <= maxEdge
  - Output is a valid JPEG smaller than the input for typical photos
  - Aspect ratio is preserved and images are never upscaled
  - **Test Task**: T2.5

#### T2.3: Implement POST /api/upload
- [ ] **Status**: TODO
- **Complexity**: High
- **Estimated**: 5 hours
- **Dependencies**: T1.4, T2.2
- **Description**:
  - **Touchpoints**: create src/routes/api/upload/+server.ts; create src/lib/server/photos.ts
  - **Contract**: POST /api/upload, multipart/form-data { photo: File, name?: string }; validates content-type image/* and size <= 8MB; key = `photos/${crypto.randomUUID()}.jpg`; PHOTOS_BUCKET.put(key, bytes); DB insert row; returns 201 { id, url, name, createdAt }
  - Accept the compressed photo and optional name and persist them
  - Store the blob in R2 and a metadata row in D1
  - Validate content type and size; return the created record with its public URL
  - **Steps**:
  - 1. Parse multipart form data and read the photo File + optional name
  - 2. Validate content-type is an image and size is within the cap
  - 3. Generate a UUID key and PHOTOS_BUCKET.put the bytes
  - 4. Insert the metadata row in D1 and return 201 with id + public URL
  - **Constraints**: Reject non-image or oversized uploads with 400; never trust client-provided filenames; sanitize/trim name and cap its length; do not block on the broadcast (added in Phase 3)
  - **Verify**: `pnpm test src/routes/api/upload`
  - **Acceptance Criteria**:
  - A valid multipart upload returns 201 with id and public R2 URL
  - The blob exists in R2 and a matching row exists in D1
  - Oversized or non-image uploads are rejected with 400
  - **Test Task**: T2.5

#### T2.4: Implement GET /api/photos
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T1.4
- **Description**:
  - **Touchpoints**: create src/routes/api/photos/+server.ts; edit src/lib/server/photos.ts
  - **Contract**: GET /api/photos?before=<ms>&limit=<n<=60>; returns { photos: [{ id, url, name, createdAt }], nextBefore }; WHERE hidden=0 ORDER BY created_at DESC; url = `${R2_PUBLIC_BASE_URL}/${r2_key}`
  - List non-hidden photos newest-first with cursor pagination
  - Map each row to a public R2 URL for the client
  - **Steps**:
  - 1. Read optional before/limit query params with safe defaults
  - 2. Query D1 for non-hidden rows ordered by created_at desc
  - 3. Map r2_key to public URL and shape the response
  - 4. Return photos plus nextBefore cursor for infinite scroll
  - **Constraints**: Never return hidden photos; clamp limit to a max of 60; pagination by created_at cursor, not offset
  - **Verify**: `pnpm test src/routes/api/photos`
  - **Acceptance Criteria**:
  - Returns only non-hidden photos, newest first
  - Each photo includes a working public R2 URL
  - Pagination via before cursor returns the next page without duplicates
  - **Test Task**: T2.5

#### T2.5: Tests for upload and listing endpoints
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T2.3, T2.4
- **Description**:
  - **Touchpoints**: create tests/upload.test.ts; create tests/photos.test.ts; edit vite.config.ts
  - **Contract**: Vitest with @cloudflare/vitest-pool-workers providing R2 + D1 bindings; covers upload success/validation and listing/hidden-filter/pagination
  - Add integration tests for the upload and listing endpoints using the Workers test pool
  - Cover happy paths, validation failures, hidden filtering, and pagination
  - **Steps**:
  - 1. Configure vitest with the Cloudflare Workers pool and test bindings
  - 2. Test upload success persists to R2 + D1 and rejects bad inputs
  - 3. Test listing excludes hidden rows and orders newest-first
  - 4. Test cursor pagination returns non-overlapping pages
  - **Constraints**: Use isolated test bindings, not production R2/D1; no real network calls
  - **Verify**: `pnpm test`
  - **Acceptance Criteria**:
  - Upload tests cover 201 success and 400 validation cases
  - Listing tests assert hidden exclusion, ordering, and pagination
  - `pnpm test` passes locally and in CI

---

### Phase 3: Realtime Gallery (Est: 2 days)

**Goal**: Broadcast new photos to all connected clients over WebSocket so the shared gallery updates live.

**Exit Criteria**:
- Durable Object maintains WebSocket connections for the gallery room
- A new upload broadcasts to all connected clients
- Client gallery prepends new photos live with a fade-in
- Reconnect logic handles dropped WebSocket connections

#### T3.1: GalleryRoom Durable Object WebSocket hub
- [ ] **Status**: TODO
- **Complexity**: High
- **Estimated**: 6 hours
- **Dependencies**: T1.4
- **Description**:
  - **Touchpoints**: create src/lib/server/GalleryRoom.ts; edit wrangler.toml; create src/routes/api/ws/+server.ts
  - **Contract**: class GalleryRoom implements DurableObject; GET /api/ws upgrades to WebSocket and forwards to the single GALLERY instance; DO tracks sockets and exposes broadcast(msg) via an internal fetch POST /broadcast; uses hibernatable WebSockets
  - Implement a Durable Object that holds all gallery WebSocket connections
  - Accept WebSocket upgrades and register/unregister sockets
  - Expose an internal broadcast entrypoint to fan out messages
  - **Steps**:
  - 1. Declare the GALLERY Durable Object binding + migration in wrangler.toml
  - 2. Implement WebSocket accept and connection bookkeeping in the DO
  - 3. Add an internal /broadcast handler that sends to all live sockets
  - 4. Add the /api/ws route that upgrades and forwards to the DO
  - **Constraints**: Single room (one DO instance) — no per-event sharding; use hibernatable WebSockets to avoid idle billing; never expose the internal broadcast endpoint publicly
  - **Verify**: `pnpm build && wrangler dev` then connect a WebSocket client to /api/ws
  - **Acceptance Criteria**:
  - A client can open a WebSocket to /api/ws and stay connected
  - The DO tracks multiple connections and drops them on close
  - An internal broadcast reaches all connected sockets
  - **Test Task**: T3.5

#### T3.2: Broadcast new photo on upload
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T3.1, T2.3
- **Description**:
  - **Touchpoints**: edit src/routes/api/upload/+server.ts; edit src/lib/server/photos.ts
  - **Contract**: after successful upload, POST to GALLERY DO /broadcast with { type: "photo:new", photo: { id, url, name, createdAt } }; failure to broadcast must not fail the upload
  - Notify the Durable Object when a new photo is stored so it fans out to clients
  - Make the broadcast best-effort so upload success never depends on it
  - **Steps**:
  - 1. After the D1 insert, build the photo:new payload
  - 2. Get the GALLERY DO stub and POST the broadcast message
  - 3. Wrap the broadcast in try/catch so failures are logged, not fatal
  - **Constraints**: Upload response must not block on broadcast latency; never include hidden photos; payload shape matches GET /api/photos items
  - **Verify**: `pnpm test src/routes/api/upload` (asserts broadcast invoked, upload still 201 if it fails)
  - **Acceptance Criteria**:
  - A successful upload triggers a photo:new broadcast
  - Broadcast payload matches the listing item shape
  - Upload still returns 201 when broadcast fails
  - **Test Task**: T3.5

#### T3.3: Live gallery client with WebSocket store
- [ ] **Status**: TODO
- **Complexity**: High
- **Estimated**: 6 hours
- **Dependencies**: T3.1, T2.4
- **Description**:
  - **Touchpoints**: create src/lib/gallery.ts; create src/lib/components/Gallery.svelte; edit src/routes/+page.svelte
  - **Contract**: gallery store loads initial page from GET /api/photos, opens WebSocket to /api/ws, on photo:new prepends to the store (dedupe by id); Gallery.svelte renders a responsive masonry grid with fade-in on new items
  - Build the shared gallery that seeds from the API then updates live
  - Prepend incoming photos with de-duplication and a fade-in animation
  - **Steps**:
  - 1. Create a Svelte store seeded by the first /api/photos page
  - 2. Open the WebSocket and merge photo:new events, deduping by id
  - 3. Render a responsive masonry grid bound to the store
  - 4. Animate newly inserted items with a fade/scale-in transition
  - **Constraints**: Dedupe so a client's own upload is not shown twice; lazy-load images; no layout jump when items prepend
  - **Verify**: `pnpm build` then two browsers: one uploads, the other sees it live
  - **Acceptance Criteria**:
  - Gallery seeds with existing photos on load
  - A photo uploaded by another client appears live without refresh
  - Newly inserted photos animate in and are never duplicated
  - **Test Task**: T3.5

#### T3.4: WebSocket reconnect and backoff
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T3.3
- **Description**:
  - **Touchpoints**: edit src/lib/gallery.ts
  - **Contract**: on socket close/error, reconnect with exponential backoff (capped, jittered); on reconnect, refetch latest photos since last known createdAt to fill any gap
  - Keep the live gallery resilient to dropped connections
  - Reconcile missed photos after a reconnect
  - **Steps**:
  - 1. Detect close/error and schedule a reconnect with capped backoff + jitter
  - 2. Reset backoff on a successful open
  - 3. On reconnect, fetch photos newer than the last seen to fill gaps
  - 4. Pause reconnects while the tab is hidden; resume on focus
  - **Constraints**: Cap the backoff interval; avoid reconnect storms; do not duplicate photos after gap-fill (dedupe by id)
  - **Verify**: `pnpm build` then kill/restore the socket and confirm recovery with no gaps
  - **Acceptance Criteria**:
  - Connection recovers automatically after a drop
  - Backoff is bounded and resets on success
  - Photos missed during downtime appear after reconnect without duplicates
  - **Test Task**: T3.5

#### T3.5: Tests for realtime broadcast
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T3.2, T3.3
- **Description**:
  - **Touchpoints**: create tests/realtime.test.ts
  - **Contract**: Workers-pool test opens two WebSocket clients to the DO, performs an upload, asserts both receive a single photo:new with the correct payload
  - Verify the broadcast fan-out end to end at the Durable Object level
  - **Steps**:
  - 1. Connect two WebSocket clients to the gallery DO in the test pool
  - 2. Trigger an upload (or direct broadcast) and await messages
  - 3. Assert both clients receive exactly one photo:new with correct fields
  - **Constraints**: Use the Workers test pool DO support; no flaky real timers — drive deterministically
  - **Verify**: `pnpm test tests/realtime`
  - **Acceptance Criteria**:
  - Both connected clients receive the photo:new event
  - Payload matches the listing item shape
  - No duplicate or dropped messages in the test

---

### Phase 4: Admin & Moderation (Est: 1 day)

**Goal**: Give the host a password-protected panel to hide or delete photos, reflected in the public gallery and live clients.

**Exit Criteria**:
- Admin route is gated by a password stored as a secret
- Host can hide a photo so it disappears from the public gallery
- Host can permanently delete a photo from R2 and D1
- Moderation actions propagate to live clients

#### T4.1: Password-gated admin access
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 4 hours
- **Dependencies**: T1.4
- **Description**:
  - **Touchpoints**: create src/routes/admin/+page.svelte; create src/routes/admin/login/+server.ts; create src/hooks.server.ts
  - **Contract**: POST /admin/login { password } compares against ADMIN_PASSWORD; on success set HttpOnly, Secure, SameSite=Strict signed session cookie; hooks.server.ts guards /admin and /api/admin/* routes (401/redirect when unauthenticated)
  - Protect the admin area with a single password and a session cookie
  - Guard all admin routes and endpoints server-side
  - **Steps**:
  - 1. Build a login form that POSTs the password
  - 2. Compare against ADMIN_PASSWORD using a constant-time check
  - 3. Issue a signed HttpOnly session cookie on success
  - 4. Guard /admin and /api/admin/* in hooks.server.ts
  - **Constraints**: Password only on the server — never shipped to the client; use constant-time comparison; cookie HttpOnly+Secure+SameSite=Strict; no guest auth affected
  - **Verify**: `pnpm test tests/admin-auth`
  - **Acceptance Criteria**:
  - Wrong password is rejected and sets no session
  - Correct password issues an HttpOnly session cookie
  - Admin routes/endpoints return 401/redirect without a valid session
  - **Test Task**: T4.5

#### T4.2: Hide and delete moderation endpoints
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 4 hours
- **Dependencies**: T4.1, T2.3
- **Description**:
  - **Touchpoints**: create src/routes/api/admin/photos/[id]/+server.ts; edit src/lib/server/photos.ts
  - **Contract**: PATCH /api/admin/photos/:id { hidden: boolean } sets hidden flag; DELETE /api/admin/photos/:id removes the R2 object then the D1 row; both require admin session; return 200 on success, 404 if missing
  - Let the host hide (soft) or delete (hard) any photo
  - Keep R2 and D1 consistent on delete
  - **Steps**:
  - 1. Add PATCH to toggle the hidden flag in D1
  - 2. Add DELETE to remove the R2 object then the D1 row
  - 3. Return 404 for unknown ids and 200 on success
  - 4. Reuse the photos data helper for both operations
  - **Constraints**: Admin session required (enforced by hooks); delete R2 object before D1 row to avoid orphaned blobs; idempotent — repeat delete returns 404 cleanly
  - **Verify**: `pnpm test tests/admin-moderation`
  - **Acceptance Criteria**:
  - Hiding a photo sets hidden=1 and removes it from GET /api/photos
  - Deleting removes both the R2 object and the D1 row
  - Unauthenticated calls are rejected; unknown id returns 404
  - **Test Task**: T4.5

#### T4.3: Propagate moderation to live clients
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 2 hours
- **Dependencies**: T4.2, T3.2
- **Description**:
  - **Touchpoints**: edit src/routes/api/admin/photos/[id]/+server.ts; edit src/lib/gallery.ts
  - **Contract**: hide/delete broadcasts { type: "photo:remove", id } via the GALLERY DO; client gallery store removes the matching photo on receipt
  - Make moderation actions reflect instantly in every open gallery
  - **Steps**:
  - 1. After a successful hide/delete, broadcast photo:remove with the id
  - 2. Handle photo:remove in the client store by filtering out the id
  - 3. Animate removal so the grid reflows smoothly
  - **Constraints**: Best-effort broadcast — must not fail the moderation request; removal must be idempotent on the client
  - **Verify**: `pnpm build` then hide a photo in admin and watch it vanish in a guest tab
  - **Acceptance Criteria**:
  - Hiding or deleting a photo broadcasts photo:remove
  - Open guest galleries remove the photo live
  - Moderation request still succeeds if the broadcast fails

#### T4.4: Admin moderation panel UI
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 4 hours
- **Dependencies**: T4.1, T4.2
- **Description**:
  - **Touchpoints**: edit src/routes/admin/+page.svelte; create src/routes/admin/+page.server.ts
  - **Contract**: admin page server-loads ALL photos including hidden (admin-only listing); grid shows each photo with Hide/Unhide and Delete actions calling the admin endpoints with optimistic UI
  - Give the host a simple grid to review and moderate every photo
  - Include hidden photos in the admin view with clear status
  - **Steps**:
  - 1. Server-load all photos (including hidden) for the admin page
  - 2. Render a grid with per-photo Hide/Unhide and Delete buttons
  - 3. Wire buttons to the admin endpoints with optimistic updates
  - 4. Show a confirm step before destructive delete
  - **Constraints**: Admin listing must be server-side guarded; do not reuse the public listing (it filters hidden); delete requires confirmation
  - **Verify**: `pnpm build` and manual moderation round-trip in the admin panel
  - **Acceptance Criteria**:
  - Admin grid shows all photos including hidden ones with status
  - Hide/Unhide and Delete actions work and update the grid
  - Delete asks for confirmation before removing

#### T4.5: Tests for admin auth and moderation
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T4.2
- **Description**:
  - **Touchpoints**: create tests/admin-auth.test.ts; create tests/admin-moderation.test.ts
  - **Contract**: tests cover login success/failure, route guarding, hide toggles public listing, delete removes R2+D1, and unauthenticated rejection
  - Lock down the admin auth and moderation behavior with tests
  - **Steps**:
  - 1. Test login rejects wrong password and accepts correct one
  - 2. Test guarded routes/endpoints return 401 without a session
  - 3. Test hide removes a photo from the public listing
  - 4. Test delete removes both R2 object and D1 row
  - **Constraints**: Isolated test bindings; do not log or hardcode the real admin password
  - **Verify**: `pnpm test tests/admin-auth tests/admin-moderation`
  - **Acceptance Criteria**:
  - Auth tests cover accept/reject and route guarding
  - Moderation tests cover hide-filter and hard delete
  - All admin tests pass in CI

---

### Phase 5: Design Polish & Deploy (Est: 1 day)

**Goal**: Apply the dark neon-green theme, polish mobile UX and animations, and deploy to Cloudflare verified via the real QR flow.

**Exit Criteria**:
- Dark + neon green theme applied consistently with glow accents
- Smooth capture and gallery animations on mobile
- App deployed to Cloudflare with production bindings
- End-to-end QR scan to gallery flow verified on a phone

#### T5.1: Dark neon-green theme and design tokens
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 4 hours
- **Dependencies**: T1.1
- **Description**:
  - **Touchpoints**: create src/app.css; edit src/routes/+layout.svelte; create src/lib/styles/tokens.css
  - **Contract**: CSS custom properties: --bg #0a0a0a, --surface #141414, --accent #00ff88, --accent-glow rgba(0,255,136,.45), --text #e8e8e8; primary buttons use accent with a glow box-shadow; applied app-wide via layout
  - Define the dark base palette and neon green accent as reusable tokens
  - Apply the theme globally to layout, buttons, and surfaces
  - **Steps**:
  - 1. Define color/spacing/radius tokens as CSS custom properties
  - 2. Set dark base background and light text in the global stylesheet
  - 3. Style primary actions with the neon accent and glow shadow
  - 4. Apply tokens across layout, camera, gallery, and admin
  - **Constraints**: Single accent color (neon green) — no competing accents; maintain readable contrast (WCAG AA for text); tokens centralized, no scattered hex values
  - **Verify**: `pnpm build` and visual check across all pages
  - **Acceptance Criteria**:
  - Dark theme with neon green accent applied across all pages
  - Primary buttons show the green glow treatment
  - Text meets AA contrast on the dark background

#### T5.2: Mobile UX and motion polish
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 4 hours
- **Dependencies**: T5.1, T2.1, T3.3
- **Description**:
  - **Touchpoints**: edit src/lib/components/Camera.svelte; edit src/lib/components/Gallery.svelte; edit src/app.css
  - **Contract**: full-bleed camera with a large thumb-reachable shutter; gallery fade/scale-in on new items; respects prefers-reduced-motion; safe-area insets honored on notched phones
  - Make the capture and gallery experience feel polished on phones
  - Add tasteful motion that respects reduced-motion preferences
  - **Steps**:
  - 1. Make the camera full-bleed with a large bottom shutter control
  - 2. Add smooth fade/scale transitions for gallery inserts/removes
  - 3. Honor safe-area insets and prevent layout shift
  - 4. Disable non-essential motion under prefers-reduced-motion
  - **Constraints**: Touch targets >= 44px; no janky reflow on prepend; animations must degrade gracefully
  - **Verify**: `pnpm build` and manual test on iOS Safari and Android Chrome
  - **Acceptance Criteria**:
  - Camera is full-bleed with an easily reachable shutter on mobile
  - Gallery inserts/removes animate smoothly without layout jump
  - Reduced-motion preference disables non-essential animation

#### T5.3: Deploy to Cloudflare with production bindings
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 3 hours
- **Dependencies**: T1.4, T2.3, T3.1
- **Description**:
  - **Touchpoints**: edit wrangler.toml; create .github/workflows/deploy.yml
  - **Contract**: `wrangler deploy` with production R2 bucket, D1 binding, GALLERY Durable Object migration applied, ADMIN_PASSWORD set via `wrangler secret put`; CI runs build + tests then deploys on main
  - Ship the app to Cloudflare with all production bindings and secrets
  - Apply the D1 migration and Durable Object migration in production
  - **Steps**:
  - 1. Apply D1 migrations to the remote database
  - 2. Set ADMIN_PASSWORD and R2_PUBLIC_BASE_URL as production secrets/vars
  - 3. Run wrangler deploy and confirm bindings resolve in production
  - 4. Add a CI workflow that builds, tests, and deploys on main
  - **Constraints**: No secrets committed to the repo; verify Durable Object migration is applied before first WebSocket use; production bucket must have public access configured
  - **Verify**: `wrangler deploy` succeeds and the deployed URL serves the gallery
  - **Acceptance Criteria**:
  - App is reachable at its Cloudflare URL with bindings resolved
  - Upload, listing, realtime, and admin all work in production
  - ADMIN_PASSWORD is set as a secret, not committed

#### T5.4: End-to-end QR flow verification
- [ ] **Status**: TODO
- **Complexity**: Medium
- **Estimated**: 2 hours
- **Dependencies**: T5.3
- **Description**:
  - **Touchpoints**: create docs/QA.md
  - **Contract**: point the existing QR at the deployed URL; on a real phone verify scan -> capture -> upload -> own + others' photos appear live; verify admin hide/delete reflects live
  - Validate the whole guest journey on a real device via the production QR
  - Record the QA checklist and results
  - **Steps**:
  - 1. Confirm the existing QR resolves to the deployed URL
  - 2. On a phone: scan, grant camera, capture, and confirm the photo appears
  - 3. With a second device, confirm new photos appear live both ways
  - 4. From admin, hide/delete and confirm it reflects on the phones; log results in docs/QA.md
  - **Constraints**: Test on both iOS Safari and Android Chrome; use the real production QR, not a local URL
  - **Verify**: Manual: documented pass of the full scan-to-gallery flow in docs/QA.md
  - **Acceptance Criteria**:
  - Scanning the QR opens the deployed app and camera works
  - A photo captured on one phone appears live on another
  - Admin hide/delete reflects on connected devices

---
