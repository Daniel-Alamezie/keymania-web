// Makes the build fail loudly if this file is ever pulled into a client
// component. It handles bearer tokens; a stray import turning it into browser
// JavaScript is exactly the mistake worth catching at compile time.
import 'server-only';

import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

/**
 * Talking to the duel API from the Next.js server instead of the browser.
 *
 * Kinde keeps its tokens in httpOnly cookies, which browser JavaScript cannot
 * read — and that is a feature. Proxying through here means the access token is
 * attached server-side and never enters the page, so an XSS bug cannot walk off
 * with a credential.
 *
 * The one place this pattern cannot help is the WebSocket: API Gateway holds
 * that socket directly, so the browser has to present the token itself. See
 * app/api/me/duel-token/route.ts for that deliberate exception.
 */

const BASE = process.env.KEYMANIA_API_URL?.replace(/\/$/, '');

const problem = (status: number, error: string) =>
  Response.json({ error }, { status });

/**
 * Forward a request upstream and hand the response straight back.
 *
 * Status codes pass through untouched so the browser sees the API's own answer
 * — a 401 from the API stays a 401 here rather than being flattened into a 500.
 */
export async function forward(
  path: string,
  init: RequestInit = {},
  { auth = true }: { auth?: boolean } = {},
): Promise<Response> {
  if (!BASE) {
    // Local development without a deployed API: say so plainly rather than
    // failing with a fetch error against "undefined/profile".
    return problem(503, 'The duel server is not configured.');
  }

  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');

  if (auth) {
    const { getAccessTokenRaw } = getKindeServerSession();
    const token = await getAccessTokenRaw();
    if (!token) return problem(401, 'Sign in required.');
    headers.set('authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return problem(502, 'Could not reach the duel server.');
  }
}
