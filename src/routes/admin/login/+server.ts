import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual, createSessionToken, COOKIE_NAME } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	const adminPassword = platform?.env?.ADMIN_PASSWORD;
	if (!adminPassword) {
		throw error(500, 'ADMIN_PASSWORD is not configured');
	}

	let password = '';
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		const body = (await request.json()) as { password?: unknown };
		password = String(body?.password ?? '');
	} else {
		const form = await request.formData();
		password = String(form.get('password') ?? '');
	}

	if (!timingSafeEqual(password, adminPassword)) {
		throw redirect(302, '/admin/login?error=1');
	}

	const token = await createSessionToken(adminPassword);
	cookies.set(COOKIE_NAME, token, {
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		path: '/',
		maxAge: 86400
	});

	throw redirect(302, '/admin');
};
