<main>
	<header>
		<h1>Admin</h1>
		<p class="subtitle">demuri — moderation panel</p>
	</header>

	<section>
		<p class="placeholder">Moderation tools coming in the next tasks.</p>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0a0a0a;
		color: #e0e0e0;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		min-height: 100dvh;
	}

	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	header {
		border-bottom: 1px solid #1a1a1a;
		padding-bottom: 1rem;
	}

	h1 {
		margin: 0 0 0.25rem;
		font-size: 1.75rem;
		font-weight: 800;
		color: #39ff14;
		letter-spacing: -0.02em;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
	}

	.placeholder {
		color: #555;
		font-size: 0.9rem;
	}
</style>
