import type { Metadata } from 'next';
import PublicProfile from '@/components/PublicProfile';

type Params = { params: Promise<{ handle: string }> };

/**
 * Titled from the handle rather than the display name.
 *
 * The name would need fetching the profile, and this page is behind auth — the
 * server rendering the tab title has no session to fetch it with, and a title
 * that says "Loading" is worse than one that says who the URL is for.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} — KeyMania`,
    description: `Speed, duels and win rate for @${handle}.`,
  };
}

export default async function PlayerPage({ params }: Params) {
  const { handle } = await params;
  return <PublicProfile handle={handle} />;
}
