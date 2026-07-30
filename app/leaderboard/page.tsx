import type { Metadata } from 'next';
import FullBoard from '@/components/FullBoard';

export const metadata: Metadata = {
  title: 'Leaderboard · KeyMania',
  description: 'Who is winning, who is fastest, and who has survived longest.',
};

/**
 * The full board.
 *
 * `searchParams` is awaited because it is a promise in this version of Next, and
 * it is read here rather than in the client component so that a link to
 * `?board=speed` renders the right board on the server instead of flashing the
 * default first.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const { board } = await searchParams;
  return <FullBoard initial={board} />;
}
