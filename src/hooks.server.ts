import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifySessionToken, COOKIE_NAME } from '$lib/server/session';

const LOGIN_PATH = '/admin/login';

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	const isAdminApi = pathname.startsWith('/api/admin/');
	// Guard all /admin/* routes except the login page itself.
	const isAdminRoute =
		pathname.startsWith('/admin') &&
		pathname !== LOGIN_PATH &&
		!pathname.startsWith(LOGIN_PATH + '/');

	if (isAdminApi || isAdminRoute) {
		const token = event.cookies.get(COOKIE_NAME) ?? '';
		const adminPassword = event.platform?.env?.ADMIN_PASSWORD ?? '';

		const authenticated =
			!!adminPassword && !!(await verifySessionToken(token, adminPassword).catch(() => false));

		if (!authenticated) {
			if (isAdminApi) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			throw redirect(302, LOGIN_PATH);
		}
	}

	return resolve(event);
};
