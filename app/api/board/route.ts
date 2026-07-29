import { forward } from '@/lib/upstream';
import { asBoard } from '@/models/leaderboard';

/**
 * The standings.
 *
 * Public upstream, but still proxied: it keeps the API's address out of the
 * browser bundle, so the duel server is reachable only through routes this app
 * actually offers.
 *
 * The `board` parameter is resolved through `asBoard` rather than passed along,
 * which does two jobs. It settles on a real board for a junk value instead of
 * relying on the upstream route to do the same thing, and — because the result
 * is one of two string literals — the interpolation below cannot be used to
 * append anything to the upstream path.
 */
export const GET = (request: Request) => {
  const board = asBoard(new URL(request.url).searchParams.get('board'));
  return forward(`/leaderboard?board=${board}`, {}, { auth: false });
};
