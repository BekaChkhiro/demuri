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

	// Fetch the current photo as a File for download / native share. Returns
	// null if the cross-origin fetch is blocked, so callers can fall back.
	async function fetchPhotoFile(): Promise<File | null> {
		if (!lightbox) return null;
		try {
			const res = await fetch(lightbox.url, { mode: 'cors' });
			if (!res.ok) return null;
			const blob = await res.blob();
			const ext = blob.type.includes('png') ? 'png' : 'jpg';
			return new File([blob], `bolozari-${lightbox.id}.${ext}`, {
				type: blob.type || 'image/jpeg'
			});
		} catch {
			return null;
		}
	}

	async function downloadPhoto() {
		if (!lightbox) return;
		const file = await fetchPhotoFile();
		if (!file) {
			// Fallback: open in a new tab so the user can long-press / save.
			window.open(lightbox.url, '_blank', 'noopener');
			return;
		}
		const url = URL.createObjectURL(file);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	async function sharePhoto() {
		if (!lightbox) return;
		const nav = navigator as Navigator & {
			canShare?: (data?: ShareData) => boolean;
			share?: (data?: ShareData) => Promise<void>;
		};
		const file = await fetchPhotoFile();

		// Best path: native share sheet WITH the image — lets the user post to
		// Instagram (story/post), Facebook, etc. with the actual photo.
		if (file && nav.share && nav.canShare?.({ files: [file] })) {
			try {
				await nav.share({ files: [file], title: 'ბოლოზარი 2026' });
			} catch {
				/* user cancelled */
			}
			return;
		}
		// Fallback 1: native share of the photo link.
		if (nav.share) {
			try {
				await nav.share({ title: 'ბოლოზარი 2026', url: lightbox.url });
			} catch {
				/* user cancelled */
			}
			return;
		}
		// Fallback 2 (desktop): Facebook link share.
		window.open(
			`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(lightbox.url)}`,
			'_blank',
			'noopener'
		);
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

		<div class="lightbox-stage">
			<img
				src={lightbox.url}
				alt={lightbox.name ? `${lightbox.name}-ის გაზიარებული ფოტო` : 'ღონისძიების ფოტო'}
				class="lightbox-img"
			/>
			<div class="lightbox-actions" role="presentation" onclick={(e) => e.stopPropagation()}>
				<button type="button" class="icon-btn" onclick={downloadPhoto} aria-label="გადმოწერა">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M12 3v12" />
						<path d="m7 10 5 5 5-5" />
						<path d="M5 21h14" />
					</svg>
				</button>
				<button type="button" class="icon-btn" onclick={sharePhoto} aria-label="გაზიარება">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="18" cy="5" r="3" />
						<circle cx="6" cy="12" r="3" />
						<circle cx="18" cy="19" r="3" />
						<path d="m8.6 13.5 6.8 3.9" />
						<path d="m15.4 6.6-6.8 3.9" />
					</svg>
				</button>
			</div>
		</div>
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

	/* Row-major 3-column grid: newest-first items fill left→right across the top
	   row, so the most recently added photos always lead the wall. */
	.masonry {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		align-items: start;
		gap: 0.75rem;
	}

	.tile {
		position: relative;
		margin: 0;
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

	.lightbox-stage {
		position: relative;
		width: fit-content;
		max-width: 100%;
		line-height: 0;
	}

	/* Action icons sit on the bottom-left corner of the photo itself. */
	.lightbox-actions {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		display: flex;
		gap: 0.5rem;
	}

	.icon-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(6px);
		cursor: pointer;
		transition: background 0.15s, transform 0.1s;
	}

	.icon-btn:hover {
		background: rgba(0, 0, 0, 0.7);
	}

	.icon-btn:active {
		transform: scale(0.92);
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
