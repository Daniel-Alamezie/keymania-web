import { notFound } from 'next/navigation';
import LobbyLab from '@/components/LobbyLab';

/**
 * Every state the lobby has, on one screen.
 *
 * Reaching it for real needs an account, a live duel server and a second person
 * willing to sit in a room while you look at it. The waiting room is worse
 * still: it exists only between hosting and somebody arriving, a window
 * measured in seconds that cannot be held open on purpose.
 *
 * **Never in production.** `notFound()` rather than a flag, because the route
 * simply should not exist there: the build drops it, and a page that cannot be
 * reached cannot be forgotten about and left reachable.
 */
export default function LobbyDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LobbyLab />;
}
