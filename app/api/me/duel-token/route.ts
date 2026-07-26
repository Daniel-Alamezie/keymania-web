import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

/**
 * The one place a token is deliberately handed to the browser.
 *
 * Everything else goes through the server-side proxy in lib/upstream.ts, but a
 * WebSocket cannot: API Gateway holds that socket directly, and browsers cannot
 * set headers on the handshake, so the client has to present the token itself
 * inside the createRoom/joinRoom message.
 *
 * The exposure is bounded by keeping it short-lived — Kinde access tokens
 * expire in an hour — and by the API only accepting it for actions that are
 * already the player's own to take.
 */
export async function GET() {
  const { isAuthenticated, getAccessTokenRaw } = getKindeServerSession();

  if (!(await isAuthenticated())) {
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const token = await getAccessTokenRaw();
  if (!token) return Response.json({ error: 'No active session.' }, { status: 401 });

  return Response.json({ token }, {
    // Never let a proxy or the browser keep a copy of this.
    headers: { 'cache-control': 'no-store, private' },
  });
}
