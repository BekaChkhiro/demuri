<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	interface Note {
		id: string;
		url: string;
		text: string;
		createdAt: number;
	}

	let { oncreate }: { oncreate?: () => void } = $props();

	let notes = $state<Note[]>([]);
	let viewer = $state<Note | null>(null);

	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;

	async function load() {
		try {
			const res = await fetch('/api/notes');
			if (!res.ok) return;
			const data = (await res.json()) as { notes?: Note[] };
			notes = Array.isArray(data?.notes) ? data.notes : [];
		} catch {
			// Best-effort: a notes fetch failure shouldn't break the page.
		}
	}

	// Exposed so the page can refresh after a new note is posted.
	export function reload() {
		void load();
	}

	/** Prepend a note from a live `note:new` frame, de-duplicated by id. */
	function ingest(note: Note) {
		if (notes.some((n) => n.id === note.id)) return;
		notes = [note, ...notes];
	}

	function parseNoteNew(data: unknown): Note | null {
		if (typeof data !== 'string') return null;
		let msg: unknown;
		try {
			msg = JSON.parse(data);
		} catch {
			return null;
		}
		if (!msg || typeof msg !== 'object') return null;
		const env = msg as { type?: unknown; note?: unknown };
		if (env.type !== 'note:new' || !env.note || typeof env.note !== 'object') return null;
		const n = env.note as Record<string, unknown>;
		if (typeof n.id !== 'string' || typeof n.url !== 'string' || typeof n.text !== 'string') {
			return null;
		}
		return {
			id: n.id,
			url: n.url,
			text: n.text,
			createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now()
		};
	}

	function connect() {
		if (destroyed) return;
		const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
		try {
			socket = new WebSocket(`${proto}//${location.host}/api/ws`);
		} catch {
			scheduleReconnect();
			return;
		}
		socket.onmessage = (e) => {
			const note = parseNoteNew(e.data);
			if (note) ingest(note);
		};
		socket.onclose = () => {
			socket = null;
			scheduleReconnect();
		};
	}

	function scheduleReconnect() {
		if (destroyed || reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, 3000);
	}

	onMount(() => {
		void load();
		connect();
	});

	onDestroy(() => {
		destroyed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		if (socket) {
			socket.onmessage = null;
			socket.onclose = null;
			try {
				socket.close();
			} catch {
				// already closing
			}
		}
	});

	$effect(() => {
		if (!browser) return;
		if (viewer) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});
</script>

<section class="notes" aria-label="ნოუთები">
	<button type="button" class="note-item add" onclick={() => oncreate?.()}>
		<span class="bubble add-bubble">შენი note</span>
		<span class="avatar add-avatar">+</span>
	</button>

	{#each notes as note (note.id)}
		<button type="button" class="note-item" onclick={() => (viewer = note)}>
			<span class="bubble">{note.text}</span>
			<img class="avatar" src={note.url} alt="" loading="lazy" />
		</button>
	{/each}
</section>

{#if viewer}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="note-viewer"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => (viewer = null)}
	>
		<div class="note-card" role="presentation" onclick={(e) => e.stopPropagation()}>
			<img src={viewer.url} alt="" class="note-photo" />
			<p class="note-text">{viewer.text}</p>
		</div>
		<button type="button" class="note-close" aria-label="დახურვა">✕</button>
	</div>
{/if}

<style>
	.notes {
		display: flex;
		gap: 0.85rem;
		overflow-x: auto;
		padding: 0.25rem 0.1rem 0.5rem;
		scrollbar-width: none;
	}
	.notes::-webkit-scrollbar {
		display: none;
	}

	.note-item {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		width: 74px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.bubble {
		max-width: 88px;
		padding: 0.3rem 0.55rem;
		background: var(--surface);
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		font-size: 0.72rem;
		line-height: 1.2;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		position: relative;
	}

	/* little tail under the bubble */
	.bubble::after {
		content: '';
		position: absolute;
		bottom: -4px;
		left: 14px;
		width: 8px;
		height: 8px;
		background: var(--surface);
		border-right: 1px solid var(--border-subtle);
		border-bottom: 1px solid var(--border-subtle);
		transform: rotate(45deg);
	}

	.add-bubble {
		color: var(--text-muted);
	}

	.avatar {
		width: 62px;
		height: 62px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--accent);
	}

	.add-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.8rem;
		font-weight: 300;
		color: var(--accent);
		background: var(--surface);
		border: 2px dashed var(--accent);
	}

	.note-viewer {
		position: fixed;
		inset: 0;
		z-index: 150;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.9);
	}

	.note-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
		max-width: 100%;
	}

	.note-photo {
		max-width: 100%;
		max-height: 70vh;
		object-fit: contain;
		border-radius: var(--radius-lg);
	}

	.note-text {
		margin: 0;
		color: #fff;
		font-size: 1rem;
		text-align: center;
		max-width: 30rem;
	}

	.note-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.3);
		font-size: 1.1rem;
		cursor: pointer;
	}
</style>
