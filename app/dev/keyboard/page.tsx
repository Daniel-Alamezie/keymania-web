import { notFound } from 'next/navigation';
import KeyboardLab from '@/components/KeyboardLab';

/**
 * The keyboard and the hands on it, on their own.
 *
 * A prototype, and deliberately parked here rather than dropped into a lesson:
 * whether a drawn hand actually teaches a reach is a question about the drawing
 * and nothing else, and putting it in front of a script would mean judging it
 * while distracted by the script.
 *
 * **Never in production.** `notFound()` rather than a flag, because the route
 * simply should not exist there: the build drops it, and a page that cannot be
 * reached cannot be forgotten about and left reachable.
 */
export default function KeyboardDevPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <KeyboardLab />;
}
