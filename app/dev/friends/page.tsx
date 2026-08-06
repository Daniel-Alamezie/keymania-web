import { notFound } from 'next/navigation';
import FriendsLab from '@/components/FriendsLab';

/**
 * The friend row, in every state, without an account.
 *
 * The panel needs a signed-in session and a real friendship to render, so the
 * invite controls were twice designed without anybody being able to look at
 * them, and were twice too narrow. This is the cheaper way to find that out.
 *
 * **Never in production.** `notFound()` rather than a flag, because the route
 * simply should not exist there: the build drops it, and a page that cannot be
 * reached cannot be forgotten about and left reachable.
 */
export default function FriendsDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <FriendsLab />;
}
