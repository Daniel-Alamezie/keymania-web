import { forward } from '@/lib/upstream';

/**
 * Which features are open, for a caller who is not signed in.
 *
 * `/api/me/profile` carries the same answer and is the authority for anybody
 * with an account — but it needs a token, and the learning path is deliberately
 * open to signed-out visitors. They still have to be told whether the path
 * exists, and this is the route that can tell them.
 *
 * `auth: false`, which is the whole point: requiring a token here would
 * recreate the problem it exists to solve.
 */
export async function GET() {
  const res = await forward('/health', {}, { auth: false });

  /**
   * Cacheable for a minute, which the upstream call is not.
   *
   * `forward` pins every request to `cache: 'no-store'` — right for a player's
   * own record, and it wins over anything passed in, so this cannot be made to
   * cache the lambda hop without changing `forward` for everybody. What it can
   * do is let the browser and any CDN in front of it hold the answer, which is
   * where the repeat cost actually falls on a page somebody reloads.
   *
   * A minute, because the answer changes when somebody deploys rather than per
   * request, and flipping the flag on dev should still feel immediate.
   *
   * The real fix for the visible delay is the client cache in
   * `game/features.ts`: this spares the network, that spares the paint.
   */
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
