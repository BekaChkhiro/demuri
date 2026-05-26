export const COOKIE_NAME = 'admin_session';

// Fixed claim data signed by the ADMIN_PASSWORD key.
const SESSION_CLAIM = new TextEncoder().encode('admin:v1');

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
	const maxLen = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;
	for (let i = 0; i < maxLen; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

/** Constant-time string comparison (UTF-8 byte level). */
export function timingSafeEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	return timingSafeEqualBytes(enc.encode(a), enc.encode(b));
}

async function importHmacKey(password: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

/** Create a signed session token bound to the given admin password. */
export async function createSessionToken(adminPassword: string): Promise<string> {
	const key = await importHmacKey(adminPassword);
	const sig = await crypto.subtle.sign('HMAC', key, SESSION_CLAIM);
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Verify a session token using constant-time HMAC comparison.
 * Returns false on any error (bad base64, wrong key, etc.).
 */
export async function verifySessionToken(token: string, adminPassword: string): Promise<boolean> {
	try {
		const sig = Uint8Array.from(atob(token), (c) => c.charCodeAt(0));
		const key = await importHmacKey(adminPassword);
		return await crypto.subtle.verify('HMAC', key, sig, SESSION_CLAIM);
	} catch {
		return false;
	}
}
