<script lang="ts">
	import { onDestroy } from 'svelte';
	import { startStream, stopStream, captureFrame, CameraError } from '$lib/camera.js';
	import type { FacingMode } from '$lib/camera.js';
	import { compressImage } from '$lib/compress.js';

	let { oncapture }: { oncapture?: (blob: Blob) => void } = $props();

	let videoEl: HTMLVideoElement | undefined = $state();
	let stream: MediaStream | null = $state(null);
	let facingMode: FacingMode = $state('environment');
	let status: 'idle' | 'active' | 'error' = $state('idle');
	let startError: string | null = $state(null);
	let captureError: string | null = $state(null);
	let capturing: boolean = $state(false);

	$effect(() => {
		if (videoEl && stream) {
			videoEl.srcObject = stream;
		}
	});

	onDestroy(() => {
		if (stream) stopStream(stream);
	});

	async function startCamera() {
		startError = null;
		captureError = null;
		try {
			if (stream) stopStream(stream);
			stream = await startStream(facingMode);
			status = 'active';
		} catch (e) {
			stream = null;
			status = 'error';
			startError = e instanceof CameraError ? e.message : 'კამერის გაშვება ვერ მოხერხდა.';
		}
	}

	async function handleCapture() {
		if (!videoEl || capturing) return;
		captureError = null;
		capturing = true;
		try {
			const raw = await captureFrame(videoEl);
			const blob = await compressImage(raw);
			oncapture?.(blob);
		} catch {
			captureError = 'ფოტოს გადაღება ვერ მოხერხდა. სცადე თავიდან.';
		} finally {
			capturing = false;
		}
	}

	async function toggleFacing() {
		facingMode = facingMode === 'environment' ? 'user' : 'environment';
		if (status === 'active') await startCamera();
	}
</script>

<div class="camera-wrap">
	{#if status === 'idle'}
		<div class="camera-placeholder">
			<p class="hint">შეეხე კამერის გასახსნელად</p>
			<button class="btn-primary" onclick={startCamera}>კამერის გახსნა</button>
		</div>
	{:else if status === 'error'}
		<div class="camera-placeholder">
			<p class="error-text">{startError}</p>
			<button class="btn-secondary" onclick={startCamera}>თავიდან ცდა</button>
		</div>
	{:else}
		<div class="camera-view">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={videoEl} autoplay playsinline muted class="camera-video"></video>
			<div class="camera-controls">
				<button
					class="btn-capture"
					onclick={handleCapture}
					disabled={capturing}
					aria-label="ფოტოს გადაღება"
				>
					{capturing ? '…' : '●'}
				</button>
				<button
					class="btn-toggle"
					onclick={toggleFacing}
					aria-label="კამერის გადართვა"
					title="გადართე {facingMode === 'environment' ? 'წინა' : 'უკანა'} კამერაზე"
				>
					⇄
				</button>
			</div>
		</div>
		{#if captureError}
			<p class="error-text">{captureError}</p>
		{/if}
	{/if}
</div>

<style>
	.camera-wrap {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.camera-wrap {
			max-width: 480px;
			margin: 0 auto;
		}
	}

	/* On mobile the camera stays within the page's 1rem horizontal padding,
	   aligning with the name input rather than bleeding to the screen edges. */
	@media (max-width: 639px) {
		.camera-placeholder {
			min-height: min(56svh, 380px);
		}

		.camera-view {
			aspect-ratio: auto;
			height: min(60svh, 420px);
		}

		.btn-capture {
			width: 76px;
			height: 76px;
			font-size: 2.4rem;
		}
	}

	.camera-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		min-height: 300px;
		border: 2px dashed var(--accent);
		border-radius: var(--radius-lg);
		background: var(--bg);
	}

	.camera-view {
		position: relative;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: #000;
		aspect-ratio: 4 / 3;
	}

	.camera-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.camera-controls {
		position: absolute;
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
	}

	.btn-primary {
		padding: 0.75rem 2rem;
		background: var(--accent);
		color: #000;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 0 16px var(--accent-glow);
		transition: opacity 0.15s;
	}

	.btn-primary:hover {
		opacity: 0.85;
	}

	.btn-secondary {
		padding: 0.6rem 1.5rem;
		background: transparent;
		color: var(--accent);
		border: 1.5px solid var(--accent);
		border-radius: var(--radius-md);
		font-size: 0.95rem;
		cursor: pointer;
	}

	.btn-capture {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--accent);
		color: #000;
		border: 3px solid #fff;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 16px var(--accent-glow);
		transition: opacity 0.15s;
	}

	.btn-capture:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-toggle {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border: 1.5px solid rgba(255, 255, 255, 0.4);
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hint {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	.error-text {
		color: var(--error);
		font-size: 0.9rem;
		text-align: center;
		margin: 0;
	}
</style>
