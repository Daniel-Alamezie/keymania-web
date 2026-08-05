import { notFound } from 'next/navigation';
import FlameLab from '@/components/FlameLab';

/**
 * Every level of the flame, on one screen.
 *
 * The flame grows across thirty-six stars, which means the only way to see the
 * top of that range in the real app is to earn it — and the only way to compare
 * two levels is to remember what the last one looked like. That is not a way to
 * tune anything, so this shows them all at once.
 *
 * **Never in production.** `notFound()` rather than a flag or a robots rule,
 * because the route simply should not exist there: the build drops it, and a
 * page that cannot be reached cannot be forgotten about and left reachable.
 */
export default function FlameDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <FlameLab />;
}
