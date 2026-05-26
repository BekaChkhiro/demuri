<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Camera from '$lib/components/Camera.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import { createGalleryStore } from '$lib/gallery';
	import { compressImage } from '$lib/compress.js';
	import { watermark } from '$lib/watermark.js';

	let lastBlob: Blob | null = $state(null);
	let uploadState: 'idle' | 'uploading' | 'done' | 'error' = $state('idle');
	let uploadError: string | null = $state(null);

	const gallery = createGalleryStore();
	onMount(() => {
		gallery.start();
	});
	onDestroy(() => {
		gallery.destroy();
	});

	// A raw frame from the camera. Process (compress + watermark) then upload.
	function handleCapture(raw: Blob) {
		void prepareAndUpload(raw);
	}

	// Downscale, stamp the logo, then auto-upload to R2.
	async function prepareAndUpload(raw: Blob) {
		const compressed = await compressImage(raw);
		const stamped = await watermark(compressed);
		await uploadPhoto(stamped);
	}

	async function uploadPhoto(blob: Blob) {
		lastBlob = blob;
		uploadState = 'uploading';
		uploadError = null;
		try {
			const form = new FormData();
			form.append('photo', blob, 'photo.jpg');

			const res = await fetch('/api/upload', { method: 'POST', body: form });
			if (!res.ok) {
				const detail = await res.text().catch(() => '');
				throw new Error(detail || `ატვირთვა ვერ მოხერხდა (${res.status})`);
			}
			uploadState = 'done';
		} catch (e) {
			uploadState = 'error';
			uploadError = e instanceof Error ? e.message : 'ატვირთვა ვერ მოხერხდა. სცადე თავიდან.';
		}
	}

	function retryUpload() {
		if (lastBlob) void uploadPhoto(lastBlob);
	}
</script>

<main>
	<header>
		<img src="/demuri-logo.png" alt="ბოლოზარი 2026" class="logo" />
		<p class="subtitle">გახსენი კამერა და გააზიარე მომენტი.</p>
	</header>

	<section class="camera-section">
		<Camera oncapture={handleCapture} />
	</section>

	{#if uploadState !== 'idle'}
		<section class="status-section">
			{#if uploadState === 'uploading'}
				<p class="upload-status uploading" aria-live="polite">იტვირთება…</p>
			{:else if uploadState === 'done'}
				<p class="upload-status done" aria-live="polite">დაემატა მომენტი ✓</p>
			{:else if uploadState === 'error'}
				<p class="upload-status error" aria-live="assertive">{uploadError}</p>
				<button class="btn-retry" onclick={retryUpload}>თავიდან ცდა</button>
			{/if}
		</section>
	{/if}

	<section class="gallery-section">
		<h2>მომენტები</h2>
		<Gallery store={gallery} />
	</section>
</main>

<style>
	main {
		max-width: 520px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	header {
		text-align: center;
	}

	.logo {
		display: block;
		width: min(260px, 70%);
		height: auto;
		margin: 0 auto 0.5rem;
	}

	.subtitle {
		margin: 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}

	.status-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.upload-status {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.upload-status.uploading {
		color: var(--text-muted);
	}

	.upload-status.done {
		color: var(--accent);
	}

	.upload-status.error {
		color: var(--error);
	}

	.btn-retry {
		align-self: flex-start;
		padding: 0.45rem 1.1rem;
		background: transparent;
		color: var(--accent);
		border: 1.5px solid var(--accent);
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.gallery-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
