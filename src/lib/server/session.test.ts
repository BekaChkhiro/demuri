import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken, timingSafeEqual, COOKIE_NAME } from './session';

describe('COOKIE_NAME', () => {
	it('equals admin_session', () => {
		expect(COOKIE_NAME).toBe('admin_session');
	});
});

describe('timingSafeEqual', () => {
	it('returns true for identical strings', () => {
		expect(timingSafeEqual('hello', 'hello')).toBe(true);
	});

	it('returns true for two empty strings', () => {
		expect(timingSafeEqual('', '')).toBe(true);
	});

	it('returns false for strings that differ in content', () => {
		expect(timingSafeEqual('abc', 'xyz')).toBe(false);
	});

	it('returns false when strings differ only in length', () => {
		expect(timingSafeEqual('abc', 'abcd')).toBe(false);
	});

	it('returns false when one side is empty', () => {
		expect(timingSafeEqual('abc', '')).toBe(false);
	});
});

describe('createSessionToken + verifySessionToken', () => {
	it('verifies a token created with the same password', async () => {
		const token = await createSessionToken('supersecret');
		expect(await verifySessionToken(token, 'supersecret')).toBe(true);
	});

	it('rejects a token verified with a different password', async () => {
		const token = await createSessionToken('supersecret');
		expect(await verifySessionToken(token, 'wrongpassword')).toBe(false);
	});

	it('rejects an empty token string', async () => {
		expect(await verifySessionToken('', 'supersecret')).toBe(false);
	});

	it('rejects a malformed (non-base64) token', async () => {
		expect(await verifySessionToken('!!!not-valid-base64!!!', 'supersecret')).toBe(false);
	});

	it('produces the same token for the same password (deterministic HMAC)', async () => {
		const t1 = await createSessionToken('mypassword');
		const t2 = await createSessionToken('mypassword');
		expect(t1).toBe(t2);
	});

	it('produces different tokens for different passwords', async () => {
		const t1 = await createSessionToken('pass1');
		const t2 = await createSessionToken('pass2');
		expect(t1).not.toBe(t2);
	});
});
