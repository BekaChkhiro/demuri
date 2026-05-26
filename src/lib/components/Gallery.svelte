<script lang="ts">
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { browser } from '$app/environment';
	import type { GalleryStore } from '$lib/gallery';

	let { store }: { store: GalleryStore } = $props();

	const motionOk = browser && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const inParams = motionOk ? { duration: 400, start: 0.92, opacity: 0, easing: cubicOut } : { duration: 0 };
	const outParams = motionOk ? { duration: 220, start: 0.92, opacity: 0, easing: cubicOut } : { duration: 0 };
</script>

<section class="gallery" aria-live="polite">
	{#if $store.photos.length > 0}
		<div class="masonry">
			{#each $store.photos as photo (photo.id)}
				<figure
					class="tile"
					in:scale={inParams}
					out:scale={outParams}
				>
					<img
						src={photo.url}
						alt={photo.name ? `Photo shared by ${photo.name}` : 'Event photo'}
						loading="lazy"
						decoding="async"
					/>
					{#if photo.name}
						<figcaption>{photo.name}</figcaption>
					{/if}
				</figure>
			{/each}
		</div>
	{:else if $store.status === 'loading' || $store.status === 'idle'}
		<p class="placeholder">Loading the wall…</p>
	{:else if $store.status === 'error'}
		<p class="placeholder error">Couldn't load the gallery. New photos will still appear live.</p>
	{:else}
		<p class="placeholder">No photos yet — be the first to share one!</p>
	{/if}
</section>

<style>
	.gallery {
		width: 100%;
	}

	/* CSS-columns masonry: newest-first items prepend at the top-left and the
	   rest flow down without re-laying-out the whole grid. */
	.masonry {
		column-count: 2;
		column-gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.masonry {
			column-count: 3;
		}
	}

	.tile {
		break-inside: avoid;
		margin: 0 0 0.75rem;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
	}

	.tile img {
		width: 100%;
		height: auto;
		display: block;
	}

	figcaption {
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.placeholder {
		text-align: center;
		color: var(--text-dim);
		font-size: 0.9rem;
		padding: 2rem 1rem;
		margin: 0;
	}

	.placeholder.error {
		color: var(--error);
	}
</style>
