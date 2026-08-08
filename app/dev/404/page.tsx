import { notFound } from 'next/navigation';
import NotFoundLab from '@/components/NotFoundLab';

/**
 * Three candidate 404 screens, side by side.
 *
 * A real 404 cannot be compared against an alternative, because you only ever
 * see the one that shipped. This shows all three at the size they run at, so
 * the choice is made by looking rather than by imagining.
 *
 * **Never in production.** `notFound()` rather than a flag, for the same
 * reason as every other page in here: the build drops the route, and a page
 * that cannot be reached cannot be left reachable by accident. There is a
 * pleasing symmetry in this one 404ing to show the 404.
 */
export default function NotFoundDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <NotFoundLab />;
}
