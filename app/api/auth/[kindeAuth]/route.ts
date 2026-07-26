import { handleAuth } from '@kinde-oss/kinde-auth-nextjs/server';

/**
 * Kinde's OAuth endpoints: /api/auth/login, /logout, /register and
 * /kinde_callback all resolve through this one handler.
 *
 * The exchange happens server-side, so tokens land in httpOnly cookies that
 * JavaScript cannot read — an XSS bug in the game can't lift a session.
 */
export const GET = handleAuth();
