<script lang="ts">
	import { page } from '$app/state';

	const hasError = $derived(page.url.searchParams.has('error'));
</script>

<main>
	<header>
		<h1>demuri</h1>
		<p class="subtitle">Admin access</p>
	</header>

	{#if hasError}
		<p class="error" role="alert">Incorrect password. Please try again.</p>
	{/if}

	<form method="post" action="/admin/login">
		<label for="password">Password</label>
		<input
			id="password"
			type="password"
			name="password"
			autocomplete="current-password"
			required
		/>
		<button type="submit">Sign in</button>
	</form>
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
		max-width: 360px;
		margin: 0 auto;
		padding: 3rem 1rem;
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
		color: #39ff14;
		letter-spacing: -0.02em;
	}

	.subtitle {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
	}

	.error {
		margin: 0;
		padding: 0.65rem 0.75rem;
		background: #1a0000;
		border: 1px solid #660000;
		border-radius: 8px;
		color: #ff6b6b;
		font-size: 0.9rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	label {
		font-size: 0.85rem;
		color: #aaa;
	}

	input[type='password'] {
		width: 100%;
		padding: 0.65rem 0.75rem;
		background: #111;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
		color: #e0e0e0;
		font-size: 1rem;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}

	input[type='password']:focus {
		border-color: #39ff14;
	}

	button {
		padding: 0.75rem;
		background: #39ff14;
		color: #0a0a0a;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	button:hover {
		opacity: 0.85;
	}
</style>
