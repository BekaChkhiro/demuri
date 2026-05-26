<script lang="ts">
	import type { PageData } from './$types';
	import type { AdminPhoto } from './+page.server';

	let { data } = $props<{ data: PageData }>();

	let photos = $state<AdminPhoto[]>(data.photos);
	let confirmDeleteId = $state<string | null>(null);
	let pendingIds = $state(new Set<string>());

	function setPending(id: string, pending: boolean) {
		if (pending) {
			pendingIds = new Set([...pendingIds, id]);
		} else {
			const next = new Set(pendingIds);
			next.delete(id);
			pendingIds = next;
		}
	}

	async function toggleHide(id: string, hide: boolean) {
		setPending(id, true);
		const prev = photos.map((p) => ({ ...p }));
		photos = photos.map((p) => (p.id === id ? { ...p, hidden: hide } : p));

		try {
			const res = await fetch(`/api/admin/photos/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hidden: hide })
			});
			if (!res.ok) photos = prev;
		} catch {
			photos = prev;
		} finally {
			setPending(id, false);
		}
	}

	async function confirmAndDelete(id: string) {
		confirmDeleteId = null;
		setPending(id, true);

		const removed = photos.find((p) => p.id === id);
		photos = photos.filter((p) => p.id !== id);

		try {
			const res = await fetch(`/api/admin/photos/${id}`, { method: 'DELETE' });
			if (!res.ok && removed) {
				photos = [...photos, removed].sort((a, b) => b.createdAt - a.createdAt);
			}
		} catch {
			if (removed) {
				photos = [...photos, removed].sort((a, b) => b.createdAt - a.createdAt);
			}
		} finally {
			setPending(id, false);
		}
	}

	const confirmPhoto = $derived(photos.find((p) => p.id === confirmDeleteId) ?? null);
</script>

<main>
	<header>
		<div class="header-row">
			<div>
				<h1>Admin</h1>
				<p class="subtitle">demuri — moderation panel</p>
			</div>
			<a href="/admin/login" class="logout-link">Sign out</a>
		</div>
	</header>

	<section>
		<p class="count">{photos.length} photo{photos.length === 1 ? '' : 's'} total</p>

		{#if photos.length === 0}
			<p class="empty">No photos uploaded yet.</p>
		{:else}
			<div class="grid">
				{#each photos as photo (photo.id)}
					<div class="card" class:hidden-card={photo.hidden} class:pending={pendingIds.has(photo.id)}>
						<div class="thumb-wrap">
							<img src={photo.url} alt={photo.name ?? 'photo'} loading="lazy" class="thumb" />
							{#if photo.hidden}
								<span class="hidden-badge">hidden</span>
							{/if}
						</div>
						<div class="card-body">
							<p class="photo-name">{photo.name ?? '—'}</p>
							<div class="actions">
								<button
									class="btn btn-secondary"
									onclick={() => toggleHide(photo.id, !photo.hidden)}
									disabled={pendingIds.has(photo.id)}
								>
									{photo.hidden ? 'Unhide' : 'Hide'}
								</button>
								<button
									class="btn btn-danger"
									onclick={() => (confirmDeleteId = photo.id)}
									disabled={pendingIds.has(photo.id)}
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</main>

{#if confirmDeleteId !== null}
	<div
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-label="Confirm deletion"
		onclick={() => (confirmDeleteId = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDeleteId = null)}
		tabindex="-1"
	>
		<div class="dialog" role="presentation" onclick={(e) => e.stopPropagation()}>
			<h2>Delete photo?</h2>
			<p>
				{#if confirmPhoto?.name}
					<strong>{confirmPhoto.name}</strong> will be
				{:else}
					This photo will be
				{/if}
				permanently removed. This cannot be undone.
			</p>
			<div class="dialog-actions">
				<button class="btn btn-secondary" onclick={() => (confirmDeleteId = null)}>Cancel</button>
				<button
					class="btn btn-danger"
					onclick={() => confirmDeleteId && confirmAndDelete(confirmDeleteId)}
				>
					Delete permanently
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: #0a0a0a;
		color: #e0e0e0;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		min-height: 100dvh;
	}

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	header {
		border-bottom: 1px solid #1a1a1a;
		padding-bottom: 1rem;
	}

	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
		font-weight: 800;
		color: #39ff14;
		letter-spacing: -0.02em;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
	}

	.logout-link {
		color: #666;
		font-size: 0.85rem;
		text-decoration: none;
		padding: 0.35rem 0.7rem;
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		transition: border-color 0.15s;
	}

	.logout-link:hover {
		border-color: #555;
		color: #aaa;
	}

	.count {
		margin: 0 0 1rem;
		color: #555;
		font-size: 0.85rem;
	}

	.empty {
		color: #555;
		font-size: 0.9rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
	}

	.card {
		background: #111;
		border: 1px solid #1e1e1e;
		border-radius: 10px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition:
			opacity 0.2s,
			border-color 0.2s;
	}

	.card.hidden-card {
		border-color: #2a1a00;
	}

	.card.pending {
		opacity: 0.5;
		pointer-events: none;
	}

	.thumb-wrap {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		background: #0d0d0d;
	}

	.thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.hidden-badge {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		background: #ff8c00cc;
		color: #0a0a0a;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
	}

	.card-body {
		padding: 0.6rem 0.65rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.photo-name {
		margin: 0;
		font-size: 0.8rem;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.actions {
		display: flex;
		gap: 0.4rem;
	}

	.btn {
		flex: 1;
		padding: 0.4rem 0.2rem;
		border: none;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.btn-secondary {
		background: #1e1e1e;
		color: #aaa;
		border: 1px solid #2a2a2a;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #252525;
		color: #e0e0e0;
	}

	.btn-danger {
		background: #1a0000;
		color: #ff6b6b;
		border: 1px solid #440000;
	}

	.btn-danger:hover:not(:disabled) {
		background: #220000;
		border-color: #660000;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: #000000bb;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		outline: none;
	}

	.dialog {
		background: #111;
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 380px;
		width: calc(100% - 2rem);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dialog h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: #e0e0e0;
	}

	.dialog p {
		margin: 0;
		font-size: 0.9rem;
		color: #888;
		line-height: 1.5;
	}

	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.dialog-actions .btn {
		flex: none;
		padding: 0.55rem 1rem;
	}
</style>
