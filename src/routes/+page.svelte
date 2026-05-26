<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Camera from '$lib/components/Camera.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import { createGalleryStore } from '$lib/gallery';

	let name = $state('');
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

	function handleCapture(blob: Blob) {
		lastBlob = blob;
		void uploadPhoto(blob);
	}

	// Auto-upload the captured frame to R2 the moment it's taken.
	async function uploadPhoto(blob: Blob) {
		uploadState = 'uploading';
		uploadError = null;
		try {
			const form = new FormData();
			form.append('photo', blob, 'photo.jpg');
			const trimmed = name.trim();
			if (trimmed) form.append('name', trimmed);

			const res = await fetch('/api/upload', { method: 'POST', body: form });
			if (!res.ok) {
				const detail = await res.text().catch(() => '');
				throw new Error(detail || `Upload failed (${res.status})`);
			}
			uploadState = 'done';
		} catch (e) {
			uploadState = 'error';
			uploadError = e instanceof Error ? e.message : 'Upload failed. Please try again.';
		}
	}

	function retryUpload() {
		if (lastBlob) void uploadPhoto(lastBlob);
	}
</script>

<main>
	<header>
		<h1>demuri</h1>
		<p class="subtitle">Point your camera and share the moment.</p>
	</header>

	<section class="name-section">
		<label for="name-input">
			Your name <span class="optional">(optional)</span>
		</label>
		<input
			id="name-input"
			type="text"
			bind:value={name}
			placeholder="e.g. Alex"
			maxlength="50"
			autocomplete="off"
		/>
	</section>

	<section class="camera-section">
		<Camera oncapture={handleCapture} />
	</section>

	{#if uploadState !== 'idle'}
		<section class="status-section">
			{#if uploadState === 'uploading'}
				<p class="upload-status uploading" aria-live="polite">Uploading…</p>
			{:else if uploadState === 'done'}
				<p class="upload-status done" aria-live="polite">Shared to the wall ✓</p>
			{:else if uploadState === 'error'}
				<p class="upload-status error" aria-live="assertive">{uploadError}</p>
				<button class="btn-retry" onclick={retryUpload}>Retry upload</button>
			{/if}
		</section>
	{/if}

	<section class="gallery-section">
		<h2>Live wall</h2>
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

	h1 {
		margin: 0 0 0.25rem;
		font-size: 2rem;
		font-weight: 800;
		color: var(--accent);
		letter-spacing: -0.02em;
	}

	.subtitle {
		margin: 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}

	.name-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.optional {
		color: var(--text-dim);
	}

	input[type='text'] {
		width: 100%;
		padding: 0.65rem 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text);
		font-size: 1rem;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}

	input[type='text']:focus {
		border-color: var(--accent);
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
