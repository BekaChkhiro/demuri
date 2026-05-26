<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Camera from '$lib/components/Camera.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import { createGalleryStore } from '$lib/gallery';

	let name = $state('');
	let previewUrl: string | null = $state(null);

	const gallery = createGalleryStore();
	onMount(() => {
		gallery.start();
	});
	onDestroy(() => {
		gallery.destroy();
	});

	function handleCapture(blob: Blob) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(blob);
		// TODO T2.2: upload blob + name to R2
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

	{#if previewUrl}
		<section class="preview-section">
			<h2>Last capture</h2>
			<img src={previewUrl} alt="Last capture preview" class="preview-img" />
			{#if name}
				<p class="preview-name">by {name}</p>
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

	.preview-section {
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

	.preview-img {
		width: 100%;
		border-radius: 10px;
		display: block;
	}

	.preview-name {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-dim);
	}

	.gallery-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
