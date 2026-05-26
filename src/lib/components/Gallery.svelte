<script lang="ts">
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { browser } from '$app/environment';
	import type { GalleryStore } from '$lib/gallery';

	let { store }: { store: GalleryStore } = $props();

	const motionOk = browser && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const inParams = motionOk ? { duration: 400, start: 0.92, opacity: 0, easing: cubicOut } : { duration: 0 };
	const outParams = motionOk ? { duration: 220, start: 0.92, opacity: 0, easing: cubicOut } : { duration: 0 };

	type GalleryPhoto = (typeof $store.photos)[number];
	let lightbox: GalleryPhoto | null = $state(null);
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
					<button
						type="button"
						class="tile-btn"
						onclick={() => (lightbox = photo)}
						aria-label={photo.name ? `გაადიდე ${photo.name}-ის ფოტო` : 'გაადიდე ფოტო'}
					>
						<img
							src={photo.url}
							alt={photo.name ? `${photo.name}-ის გაზიარებული ფოტო` : 'ღონისძიების ფოტო'}
							loading="lazy"
							decoding="async"
						/>
					</button>
					{#if photo.name}
						<figcaption>{photo.name}</figcaption>
					{/if}
				</figure>
			{/each}
		</div>
	{:else if $store.status === 'loading' || $store.status === 'idle'}
		<p class="placeholder">კედელი იტვირთება…</p>
	{:else if $store.status === 'error'}
		<p class="placeholder error">გალერეა ვერ ჩაიტვირთა. ახალი ფოტოები მაინც გამოჩნდება ცოცხლად.</p>
	{:else}
		<p class="placeholder">ჯერ ფოტოები არ არის — გააზიარე პირველმა!</p>
	{/if}
</section>

{#if lightbox}
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label="ფოტოს ნახვა"
		onclick={() => (lightbox = null)}
		onkeydown={(e) => e.key === 'Escape' && (lightbox = null)}
		tabindex="-1"
	>
		<img
			src={lightbox.url}
			alt={lightbox.name ? `${lightbox.name}-ის გაზიარებული ფოტო` : 'ღონისძიების ფოტო'}
			class="lightbox-img"
		/>
		{#if lightbox.name}
			<p class="lightbox-caption">{lightbox.name}</p>
		{/if}
		<button type="button" class="lightbox-close" aria-label="დახურვა">✕</button>
	</div>
{/if}

<style>
	.gallery {
		width: 100%;
	}

	/* CSS-columns masonry: newest-first items prepend at the top-left and the
	   rest flow down without re-laying-out the whole grid. */
	.masonry {
		column-count: 3;
		column-gap: 0.75rem;
	}

	.tile {
		position: relative;
		break-inside: avoid;
		margin: 0 0 0.75rem;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
	}

	.tile-btn {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.tile img {
		width: 100%;
		height: auto;
		display: block;
	}

	/* Caption overlays the bottom of the photo so a captioned tile is the same
	   height as an uncaptioned one — the image alone defines the tile height. */
	figcaption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.75rem 0.6rem 0.4rem;
		font-size: 0.8rem;
		color: #fff;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0));
		pointer-events: none;
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

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.9);
		cursor: zoom-out;
	}

	.lightbox-img {
		max-width: 100%;
		max-height: 85vh;
		object-fit: contain;
		border-radius: var(--radius-md);
	}

	.lightbox-caption {
		margin: 0;
		color: #fff;
		font-size: 0.95rem;
		text-align: center;
	}

	.lightbox-close {
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
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
