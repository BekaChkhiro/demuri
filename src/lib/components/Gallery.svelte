<script lang="ts">
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { GalleryStore } from '$lib/gallery';

	let { store }: { store: GalleryStore } = $props();
</script>

<section class="gallery" aria-live="polite">
	{#if $store.photos.length > 0}
		<div class="masonry">
			{#each $store.photos as photo (photo.id)}
				<figure
					class="tile"
					in:scale={{ duration: 400, start: 0.92, opacity: 0, easing: cubicOut }}
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
		border-radius: 10px;
		overflow: hidden;
		background: #111;
		border: 1px solid #1c1c1c;
	}

	.tile img {
		width: 100%;
		height: auto;
		display: block;
	}

	figcaption {
		padding: 0.4rem 0.6rem;
		font-size: 0.8rem;
		color: #888;
	}

	.placeholder {
		text-align: center;
		color: #555;
		font-size: 0.9rem;
		padding: 2rem 1rem;
		margin: 0;
	}

	.placeholder.error {
		color: #ff4d4d;
	}
</style>
