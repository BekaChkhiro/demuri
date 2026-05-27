import { redirect, error } from '@sveltejs/kit';
import type { Actions } from './$types';
import { timingSafeEqual, createSessionToken, COOKIE_NAME } from '$lib/server/session';

// Login is a form action (not a +server.ts) so the same /admin/login route can
// serve the page on GET and handle the sign-in POST without a method conflict.
export const actions: Actions = {
	default: async ({ request, cookies, platform }) => {
		const adminPassword = platform?.env?.ADMIN_PASSWORD;
		if (!adminPassword) {
			throw error(500, 'ADMIN_PASSWORD is not configured');
		}

		const form = await request.formData();
		const password = String(form.get('password') ?? '');

		if (!timingSafeEqual(password, adminPassword)) {
			throw redirect(303, '/admin/login?error=1');
		}

		const token = await createSessionToken(adminPassword);
		cookies.set(COOKIE_NAME, token, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			path: '/',
			maxAge: 86400
		});

		throw redirect(303, '/admin');
	}
};
