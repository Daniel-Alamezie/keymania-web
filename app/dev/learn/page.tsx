import { notFound } from 'next/navigation';
import LearnLab from '@/components/LearnLab';

/**
 * Put the learning path into any state a player could be in.
 *
 * Play-testing the path means reaching states that normally take an hour to
 * earn: a fresh arrival, a module part-finished, everything but the last
 * boss, a guest with local progress. Reaching them by playing is not testing,
 * it is waiting.
 *
 * **Never in production**, the same `notFound()` as /dev/flame: the route
 * simply should not exist there, so the build drops it and a page nobody can
 * reach cannot be left reachable.
 */
export default function LearnDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LearnLab />;
}
