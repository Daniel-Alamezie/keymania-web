import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { forward } from '@/lib/upstream';

/**
 * The signed-in player's own record.
 *
 * Carries the Kinde name upstream. The API authenticates with the access
 * token, which holds `sub` and nothing else — no name, no email — so without
 * this the server has no idea what anybody is called, and the handle it seeds
 * for a new account came out as "typist" for everybody.
 *
 * This is the only place that can supply it: the browser never sees the token,
 * and the token never carries the name. The BFF is the single point holding
 * both the Kinde session and the upstream call.
 */
export async function GET() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  // Given name first, email local part second. Deliberately not the full name:
  // a handle is a short public identifier with a length cap, and "daniel" is a
  // better starting point than "danielalamezie" truncated to fit.
  const name = user?.given_name?.trim() || user?.email?.split('@')[0] || '';

  return forward('/profile', name ? { headers: { 'x-player-name': name } } : {});
}

/** Change the name shown to opponents and on the leaderboard. */
export async function PUT(request: Request) {
  return forward('/profile', { method: 'PUT', body: await request.text() });
}
