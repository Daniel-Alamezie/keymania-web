import { forward } from '@/lib/upstream';
import { asBoard, boardQuery } from '@/models/leaderboard';
import { asCountry } from '@/models/countries';

/**
 * The standings.
 *
 * Public upstream, but still proxied: it keeps the API's address out of the
 * browser bundle, so the duel server is reachable only through routes this app
 * actually offers.
 *
 * Both parameters are rebuilt through `boardQuery` rather than passed along.
 * That settles on a real board and a sane row count for junk input instead of
 * relying on the upstream route to do the same thing, and — because everything
 * interpolated is either a fixed string literal or a clamped integer — the
 * upstream path cannot be extended by anything a caller sends.
 *
 * **It also forwarded only `board` for a while, and dropped the row count in
 * silence.** The client asked for fifty and the API answered ten, every time,
 * so the "Show more" control could never appear and the page reported "showing
 * all 10 ranked players" while fifteen were ranked. Neither file was wrong; the
 * agreement between them was just never written anywhere. It is written in
 * `boardQuery` now, and this calls it rather than assembling its own.
 *
 * **And it happened again, one parameter over.** `country` was added to
 * `boardQuery`, to the client and to the upstream route, and dropped here --
 * so `?country=GB` came back as the global board with nothing saying so, which
 * is worse than an error because the rows look perfectly correct. Caught by
 * probing production rather than by any test, exactly as the row count was.
 *
 * The lesson the paragraph above recorded did not generalise on its own, so it
 * is worth stating plainly: every parameter this proxy does not name is a
 * parameter it silently discards, and the failure always looks like a working
 * page showing the wrong thing.
 */
export const GET = (request: Request) => {
  const asked = new URL(request.url).searchParams;
  const board = asBoard(asked.get('board'));
  // Validated here as well as upstream, which keeps this route's own guarantee
  // intact: everything interpolated into the upstream path is a fixed literal,
  // a clamped integer, or a value from a known list.
  const country = asCountry(asked.get('country'));
  return forward(
    `/leaderboard?${boardQuery(board, Number(asked.get('limit')), country)}`,
    {},
    { auth: false },
  );
};
