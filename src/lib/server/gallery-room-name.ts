/**
 * Fixed name addressing the single GalleryRoom Durable Object instance.
 *
 * The app has one shared gallery (no per-event sharding), so every WebSocket
 * upgrade and every broadcast resolves the DO via `idFromName(GALLERY_ROOM_NAME)`
 * — guaranteeing they all land on the same instance.
 */
export const GALLERY_ROOM_NAME = 'gallery';
