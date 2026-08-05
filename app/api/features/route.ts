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
  return forward('/health', {}, { auth: false });
}
