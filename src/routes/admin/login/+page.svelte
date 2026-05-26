<script lang="ts">
	import { page } from '$app/state';

	const hasError = $derived(page.url.searchParams.has('error'));
</script>

<main>
	<header>
		<h1>demuri</h1>
		<p class="subtitle">ადმინის წვდომა</p>
	</header>

	{#if hasError}
		<p class="error" role="alert">არასწორი პაროლი. სცადე თავიდან.</p>
	{/if}

	<form method="post" action="/admin/login">
		<label for="password">პაროლი</label>
		<input
			id="password"
			type="password"
			name="password"
			autocomplete="current-password"
			required
		/>
		<button type="submit">შესვლა</button>
	</form>
</main>

<style>
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
		color: var(--accent);
		letter-spacing: -0.02em;
	}

	.subtitle {
		margin: 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}

	.error {
		margin: 0;
		padding: 0.65rem 0.75rem;
		background: var(--error-bg);
		border: 1px solid var(--error-border-bright);
		border-radius: var(--radius-md);
		color: var(--error-bright);
		font-size: 0.9rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	label {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	input[type='password'] {
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

	input[type='password']:focus {
		border-color: var(--accent);
	}

	button {
		padding: 0.75rem;
		background: var(--accent);
		color: var(--bg);
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 0 16px var(--accent-glow);
		transition: opacity 0.15s;
	}

	button:hover {
		opacity: 0.85;
	}
</style>
