import { describe, it, expect, vi } from 'vitest';
import { handle } from './hooks.server';
import { createSessionToken, COOKIE_NAME } from '$lib/server/session';

const PASSWORD = 'adminpw123';

function makeEvent(pathname: string, opts: { token?: string; adminPassword?: string } = {}) {
	return {
		url: { pathname },
		cookies: { get: vi.fn().mockReturnValue(opts.token ?? '') },
		platform: { env: { ADMIN_PASSWORD: opts.adminPassword ?? PASSWORD } }
	} as never;
}

function okResolve() {
	return vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
}

describe('handle — public routes pass through', () => {
	it('resolves without auth check on a non-admin route', async () => {
		const resolve = okResolve();
		await handle({ event: makeEvent('/'), resolve });
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('does not block /api/photos (non-admin API)', async () => {
		const resolve = okResolve();
		await handle({ event: makeEvent('/api/photos'), resolve });
		expect(resolve).toHaveBeenCalledOnce();
	});
});

describe('handle — /admin/login is not guarded', () => {
	it('passes through with no token', async () => {
		const resolve = okResolve();
		await handle({ event: makeEvent('/admin/login', { token: '' }), resolve });
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('passes through even when ADMIN_PASSWORD is not configured', async () => {
		const resolve = okResolve();
		await handle({
			event: makeEvent('/admin/login', { token: '', adminPassword: '' }),
			resolve
		});
		expect(resolve).toHaveBeenCalledOnce();
	});
});

describe('handle — admin API without valid auth returns 401', () => {
	it('returns 401 JSON when no token cookie is present', async () => {
		const resolve = okResolve();
		const res = await handle({ event: makeEvent('/api/admin/photos/abc'), resolve });
		expect(res.status).toBe(401);
		expect(await (res as Response).json()).toMatchObject({ error: expect.any(String) });
		expect(resolve).not.toHaveBeenCalled();
	});

	it('returns 401 when ADMIN_PASSWORD is not configured (empty string)', async () => {
		const resolve = okResolve();
		const res = await handle({
			event: makeEvent('/api/admin/photos/abc', { token: 'anything', adminPassword: '' }),
			resolve
		});
		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('returns 401 for a wrong token', async () => {
		const resolve = okResolve();
		const res = await handle({
			event: makeEvent('/api/admin/photos/abc', { token: 'wrongtoken' }),
			resolve
		});
		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});
});

describe('handle — admin API with valid token', () => {
	it('calls resolve when session token matches the admin password', async () => {
		const token = await createSessionToken(PASSWORD);
		const resolve = okResolve();
		await handle({ event: makeEvent('/api/admin/photos/abc', { token }), resolve });
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('uses the COOKIE_NAME constant to read the token', async () => {
		const token = await createSessionToken(PASSWORD);
		const event = {
			url: { pathname: '/api/admin/photos/abc' },
			cookies: { get: vi.fn().mockReturnValue(token) },
			platform: { env: { ADMIN_PASSWORD: PASSWORD } }
		} as never;
		const resolve = okResolve();
		await handle({ event, resolve });
		expect((event as { cookies: { get: ReturnType<typeof vi.fn> } }).cookies.get).toHaveBeenCalledWith(
			COOKIE_NAME
		);
	});
});

describe('handle — admin UI without valid auth redirects to login', () => {
	it('throws a 302 redirect to /admin/login for the /admin route', async () => {
		const resolve = okResolve();
		await expect(
			handle({ event: makeEvent('/admin'), resolve })
		).rejects.toMatchObject({ status: 302, location: '/admin/login' });
		expect(resolve).not.toHaveBeenCalled();
	});

	it('throws a redirect for a nested admin UI path', async () => {
		const resolve = okResolve();
		await expect(
			handle({ event: makeEvent('/admin/photos'), resolve })
		).rejects.toMatchObject({ status: 302, location: '/admin/login' });
	});
});

describe('handle — admin UI with valid token', () => {
	it('calls resolve and does not redirect', async () => {
		const token = await createSessionToken(PASSWORD);
		const resolve = okResolve();
		await handle({ event: makeEvent('/admin', { token }), resolve });
		expect(resolve).toHaveBeenCalledOnce();
	});
});
