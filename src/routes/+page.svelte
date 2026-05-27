<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Camera from '$lib/components/Camera.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import NotesBar from '$lib/components/NotesBar.svelte';
	import { createGalleryStore } from '$lib/gallery';
	import { compressImage } from '$lib/compress.js';
	import { watermark } from '$lib/watermark.js';

	let lastBlob: Blob | null = $state(null);
	let uploadState: 'idle' | 'uploading' | 'done' | 'error' = $state('idle');
	let uploadError: string | null = $state(null);

	let cameraRef: { open: () => void } | undefined = $state();
	let notesBarRef: { reload: () => void } | undefined = $state();
	// Where the next capture goes: the wall, or a new note.
	let captureTarget: 'wall' | 'note' = $state('wall');

	// Note composer state (shown after capturing a photo for a note).
	let noteRaw: Blob | null = $state(null);
	let notePreview: string | null = $state(null);
	let noteText = $state('');
	let notePosting = $state(false);
	let noteError: string | null = $state(null);

	const gallery = createGalleryStore();
	onMount(() => {
		gallery.start();
	});
	onDestroy(() => {
		gallery.destroy();
		if (notePreview) URL.revokeObjectURL(notePreview);
	});

	function startNote() {
		captureTarget = 'note';
		cameraRef?.open();
	}

	// A raw frame from the camera — route it to the wall or the note composer.
	function handleCapture(raw: Blob) {
		if (captureTarget === 'note') {
			captureTarget = 'wall';
			if (notePreview) URL.revokeObjectURL(notePreview);
			noteRaw = raw;
			notePreview = URL.createObjectURL(raw);
			noteText = '';
			noteError = null;
			return;
		}
		void prepareAndUpload(raw);
	}

	function cancelNote() {
		if (notePreview) URL.revokeObjectURL(notePreview);
		noteRaw = null;
		notePreview = null;
		noteText = '';
		noteError = null;
	}

	async function postNote() {
		if (!noteRaw || notePosting) return;
		const text = noteText.trim();
		if (!text) {
			noteError = 'დაწერე ტექსტი';
			return;
		}
		notePosting = true;
		noteError = null;
		try {
			const compressed = await compressImage(noteRaw);
			const form = new FormData();
			form.append('photo', compressed, 'note.jpg');
			form.append('text', text);
			const res = await fetch('/api/notes', { method: 'POST', body: form });
			if (!res.ok) throw new Error('post failed');
			cancelNote();
			notesBarRef?.reload();
		} catch {
			noteError = 'ვერ აიტვირთა. სცადე თავიდან.';
		} finally {
			notePosting = false;
		}
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

	<section class="notes-section">
		<NotesBar bind:this={notesBarRef} oncreate={startNote} />
	</section>

	<section class="camera-section">
		<Camera bind:this={cameraRef} oncapture={handleCapture} />
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

{#if noteRaw}
	<div class="note-composer" role="dialog" aria-modal="true" aria-label="ახალი note">
		<div class="composer-card">
			{#if notePreview}
				<img src={notePreview} alt="გადაღებული ფოტო" class="composer-preview" />
			{/if}
			<input
				class="composer-input"
				type="text"
				bind:value={noteText}
				placeholder="დაწერე რაიმე..."
				maxlength="80"
				autocomplete="off"
			/>
			{#if noteError}
				<p class="composer-error">{noteError}</p>
			{/if}
			<div class="composer-actions">
				<button class="composer-btn ghost" onclick={cancelNote} disabled={notePosting}>
					გაუქმება
				</button>
				<button class="composer-btn primary" onclick={postNote} disabled={notePosting}>
					{notePosting ? '...' : 'გამოქვეყნება'}
				</button>
			</div>
		</div>
	</div>
{/if}

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

	.notes-section {
		width: 100%;
	}

	.status-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.note-composer {
		position: fixed;
		inset: 0;
		z-index: 220;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		background: rgba(0, 0, 0, 0.85);
	}

	.composer-card {
		width: 100%;
		max-width: 360px;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		padding: 1rem;
	}

	.composer-preview {
		width: 100%;
		max-height: 50vh;
		object-fit: contain;
		border-radius: var(--radius-md);
		background: #000;
	}

	.composer-input {
		width: 100%;
		padding: 0.65rem 0.75rem;
		background: var(--bg);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--text);
		font-size: 1rem;
		outline: none;
		box-sizing: border-box;
	}

	.composer-input:focus {
		border-color: var(--accent);
	}

	.composer-error {
		margin: 0;
		color: var(--error);
		font-size: 0.85rem;
	}

	.composer-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
	}

	.composer-btn {
		padding: 0.55rem 1.1rem;
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		border: none;
	}

	.composer-btn.ghost {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-subtle);
	}

	.composer-btn.primary {
		background: var(--accent);
		color: #000;
		box-shadow: 0 0 14px var(--accent-glow);
	}

	.composer-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
