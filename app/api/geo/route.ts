import { asCountry } from '@/models/countries';

/**
 * GET /api/geo — where this request appears to come from.
 *
 * **A suggestion, and only ever that.** Nothing here is stored. The picker
 * shows it as "we think you're in X" and a player confirms it or chooses
 * something else; the country on their record is written by PUT /profile and by
 * nothing else. That separation is the whole consent design — see updateProfile
 * upstream, where the same point is made from the other side.
 *
 * The value comes from `x-vercel-ip-country`, which Vercel sets at the edge and
 * **overwrites** on every inbound request. A browser cannot forge it by sending
 * its own copy. Even if it could, the stakes are a different default in a
 * dropdown the player is about to answer anyway.
 *
 * Deliberately not folded into the profile response. That would mean reading a
 * location on every page load for a fact wanted once, and would put a derived
 * location into the payload that renders somebody's card — which is exactly the
 * shape of accident this feature is trying not to have.
 */
export function GET(request: Request) {
  const guess = asCountry(request.headers.get('x-vercel-ip-country'));

  return Response.json(
    // Absent rather than null when the edge has no opinion: locally there is no
    // header at all, and "we think you're in nowhere" is not a thing to say.
    guess ? { country: guess } : {},
    {
      /**
       * Never cached, and never by a shared cache in particular.
       *
       * This response varies by the caller's own address. A CDN or proxy that
       * cached one player's answer would hand the next player somebody else's
       * country as their suggestion, which is both wrong and the kind of wrong
       * that looks like a working feature.
       */
      headers: { 'cache-control': 'private, no-store' },
    },
  );
}
