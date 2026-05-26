<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
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
	let flash: boolean = $state(false);

	$effect(() => {
		if (videoEl && stream) {
			videoEl.srcObject = stream;
		}
	});

	// Lock page scroll while the full-screen camera is open.
	$effect(() => {
		if (!browser) return;
		if (status === 'active') {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
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

	function closeCamera() {
		if (stream) stopStream(stream);
		stream = null;
		status = 'idle';
	}

	async function handleCapture() {
		if (!videoEl || capturing) return;
		captureError = null;
		capturing = true;
		try {
			const raw = await captureFrame(videoEl);
			flash = true;
			setTimeout(() => (flash = false), 180);
			oncapture?.(raw);
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
			<p class="hint">დააჭირე ღილაკს გასახსნელად</p>
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

			{#if flash}
				<div class="flash"></div>
			{/if}

			<button class="btn-close" onclick={closeCamera} aria-label="დახურვა">✕</button>

			{#if captureError}
				<p class="error-text overlay-error">{captureError}</p>
			{/if}

			<div class="camera-controls">
				<button
					class="btn-toggle"
					onclick={toggleFacing}
					aria-label="კამერის გადართვა"
					title="გადართე {facingMode === 'environment' ? 'წინა' : 'უკანა'} კამერაზე"
				>
					⇄
				</button>
				<button
					class="btn-capture"
					onclick={handleCapture}
					disabled={capturing}
					aria-label="ფოტოს გადაღება"
				>
					<img src="/demuri-logo.png" alt="" class="btn-capture-logo" />
				</button>
				<span class="control-spacer"></span>
			</div>
		</div>
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

	@media (max-width: 639px) {
		.camera-placeholder {
			min-height: min(56svh, 380px);
		}
	}

	/* Active camera takes over the whole screen, like a native camera app. */
	.camera-view {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: #000;
		overflow: hidden;
	}

	.camera-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.flash {
		position: absolute;
		inset: 0;
		background: #fff;
		animation: flash-fade 0.18s ease-out;
		pointer-events: none;
	}

	@keyframes flash-fade {
		from {
			opacity: 0.9;
		}
		to {
			opacity: 0;
		}
	}

	.btn-close {
		position: absolute;
		top: calc(0.9rem + env(safe-area-inset-top, 0px));
		left: 0.9rem;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.3);
		font-size: 1.1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(6px);
	}

	.camera-controls {
		position: absolute;
		bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
		left: 0;
		right: 0;
		padding: 0 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	/* Shutter button: white disc with the logo centered, neon-green ring. */
	.btn-capture {
		width: 74px;
		height: 74px;
		border-radius: 50%;
		background: #fff;
		border: 4px solid var(--accent);
		box-shadow: 0 0 18px var(--accent-glow), 0 0 0 2px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		transition: transform 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 0;
	}

	.btn-capture-logo {
		width: 78%;
		height: auto;
		object-fit: contain;
		pointer-events: none;
	}

	.btn-capture:active {
		transform: scale(0.92);
	}

	.btn-capture:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-toggle {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.3);
		font-size: 1.3rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(6px);
	}

	/* Balances the flip button so the shutter stays centered. */
	.control-spacer {
		width: 48px;
		height: 48px;
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

	.overlay-error {
		position: absolute;
		bottom: calc(7rem + env(safe-area-inset-bottom, 0px));
		left: 1rem;
		right: 1rem;
		color: #fff;
		background: rgba(200, 0, 0, 0.7);
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
	}
</style>
