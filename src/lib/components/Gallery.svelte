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

	const lightboxIndex = $derived(
		lightbox ? $store.photos.findIndex((p) => p.id === lightbox!.id) : -1
	);
	const hasPrev = $derived(lightboxIndex > 0);
	const hasNext = $derived(lightboxIndex >= 0 && lightboxIndex < $store.photos.length - 1);

	function showPrev() {
		if (hasPrev) lightbox = $store.photos[lightboxIndex - 1];
	}
	function showNext() {
		if (hasNext) lightbox = $store.photos[lightboxIndex + 1];
	}

	function onLightboxKey(e: KeyboardEvent) {
		if (!lightbox) return;
		if (e.key === 'Escape') lightbox = null;
		else if (e.key === 'ArrowLeft') showPrev();
		else if (e.key === 'ArrowRight') showNext();
	}

	// Lock page scroll while the full-screen viewer is open.
	$effect(() => {
		if (!browser) return;
		if (lightbox) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});
</script>

<svelte:window onkeydown={onLightboxKey} />

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
	<!-- Keyboard (Esc / arrows) is handled globally via svelte:window above; the
	     backdrop click only closes. -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label="ფოტოს ნახვა"
		onclick={() => (lightbox = null)}
		tabindex="-1"
	>
		{#if hasPrev}
			<button
				type="button"
				class="lightbox-arrow prev"
				aria-label="წინა ფოტო"
				onclick={(e) => {
					e.stopPropagation();
					showPrev();
				}}
			>
				‹
			</button>
		{/if}
		{#if hasNext}
			<button
				type="button"
				class="lightbox-arrow next"
				aria-label="შემდეგი ფოტო"
				onclick={(e) => {
					e.stopPropagation();
					showNext();
				}}
			>
				›
			</button>
		{/if}

		<img
			src={lightbox.url}
			alt={lightbox.name ? `${lightbox.name}-ის გაზიარებული ფოტო` : 'ღონისძიების ფოტო'}
			class="lightbox-img"
		/>
		{#if lightbox.name}
			<p class="lightbox-caption">{lightbox.name}</p>
		{/if}

		<!-- Thumbnail strip: stop propagation so picking another photo doesn't
		     close the lightbox (the backdrop click handler does that). -->
		<div class="lightbox-strip" role="presentation" onclick={(e) => e.stopPropagation()}>
			{#each $store.photos as p (p.id)}
				<button
					type="button"
					class="strip-thumb"
					class:active={p.id === lightbox.id}
					onclick={() => (lightbox = p)}
					aria-label={p.name ? `${p.name}-ის ფოტო` : 'ფოტო'}
				>
					<img src={p.url} alt="" loading="lazy" />
				</button>
			{/each}
		</div>

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
		max-height: 68vh;
		object-fit: contain;
		border-radius: var(--radius-md);
	}

	.lightbox-caption {
		margin: 0;
		color: #fff;
		font-size: 0.95rem;
		text-align: center;
	}

	.lightbox-strip {
		display: flex;
		gap: 0.5rem;
		max-width: 100%;
		overflow-x: auto;
		padding: 0.25rem;
		scrollbar-width: thin;
	}

	.strip-thumb {
		flex: 0 0 auto;
		width: 64px;
		height: 64px;
		padding: 0;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: none;
		cursor: pointer;
		opacity: 0.55;
		transition: opacity 0.15s, border-color 0.15s;
	}

	.strip-thumb:hover {
		opacity: 0.85;
	}

	.strip-thumb.active {
		opacity: 1;
		border-color: var(--accent);
	}

	.strip-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
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

	.lightbox-arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.3);
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}

	.lightbox-arrow.prev {
		left: 1rem;
	}

	.lightbox-arrow.next {
		right: 1rem;
	}

	.lightbox-arrow:hover {
		background: rgba(255, 255, 255, 0.22);
	}
</style>
