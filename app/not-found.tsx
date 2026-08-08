import type { Metadata } from 'next';
import NotFoundEscape from '@/components/NotFoundEscape';

/**
 * The 404, which you type your way out of.
 *
 * Reached by any unknown URL, and by every `/dev/*` route in production, which
 * call `notFound()` on purpose so those pages cannot be left reachable. Until
 * now all of that landed on Next's default grey page: correct, and the only
 * screen on the site that looked like it belonged to a different product.
 *
 * See `components/NotFoundEscape` for why the typing is a door rather than a
 * lock. The short version is that the way out is one click from the first
 * frame, and the game on top of it is a bonus for anybody who feels like it.
 */

export const metadata: Metadata = {
  title: 'Page not found',
  /* Nothing here for an index to keep. A 404 that ranks is a 404 that sends
     the next person to the same dead end. */
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundEscape full />;
}
