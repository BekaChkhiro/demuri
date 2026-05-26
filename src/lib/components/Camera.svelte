<script lang="ts">
	import { onDestroy } from 'svelte';
	import { startStream, stopStream, captureFrame, CameraError } from '$lib/camera.js';
	import type { FacingMode } from '$lib/camera.js';

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
			startError = e instanceof CameraError ? e.message : 'Could not start the camera.';
		}
	}

	async function handleCapture() {
		if (!videoEl || capturing) return;
		captureError = null;
		capturing = true;
		try {
			const blob = await captureFrame(videoEl);
			oncapture?.(blob);
		} catch {
			captureError = 'Failed to capture photo. Please try again.';
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
			<p class="hint">Tap to open the camera</p>
			<button class="btn-primary" onclick={startCamera}>Open Camera</button>
		</div>
	{:else if status === 'error'}
		<div class="camera-placeholder">
			<p class="error-text">{startError}</p>
			<button class="btn-secondary" onclick={startCamera}>Try Again</button>
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
					aria-label="Capture photo"
				>
					{capturing ? '…' : '●'}
				</button>
				<button
					class="btn-toggle"
					onclick={toggleFacing}
					aria-label="Switch camera"
					title="Switch to {facingMode === 'environment' ? 'front' : 'rear'} camera"
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
		max-width: 480px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.camera-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		min-height: 300px;
		border: 2px dashed #39ff14;
		border-radius: 12px;
		background: #0a0a0a;
	}

	.camera-view {
		position: relative;
		border-radius: 12px;
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
		bottom: 1rem;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
	}

	.btn-primary {
		padding: 0.75rem 2rem;
		background: #39ff14;
		color: #000;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-primary:hover {
		background: #2be010;
	}

	.btn-secondary {
		padding: 0.6rem 1.5rem;
		background: transparent;
		color: #39ff14;
		border: 1.5px solid #39ff14;
		border-radius: 8px;
		font-size: 0.95rem;
		cursor: pointer;
	}

	.btn-capture {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: #39ff14;
		color: #000;
		border: 3px solid #fff;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
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
		color: #888;
		font-size: 0.9rem;
		margin: 0;
	}

	.error-text {
		color: #ff4d4d;
		font-size: 0.9rem;
		text-align: center;
		margin: 0;
	}
</style>
