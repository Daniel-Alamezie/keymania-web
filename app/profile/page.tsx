import type { Metadata } from 'next';
import ProfileDashboard from '@/components/ProfileDashboard';

export const metadata: Metadata = {
  title: 'Your profile — KeyMania',
  description: 'Your display name, your speed, and how it has been trending.',
  /**
   * Kept out of the index, because there is nothing here to index.
   *
   * This is one route serving a different dashboard to every signed-in person,
   * and nothing at all to a crawler, which arrives with no session and gets an
   * empty shell. Google was reporting it under "crawled, currently not
   * indexed", which is Search Console's way of saying it looked and found the
   * page not worth keeping. It was right, and saying so here turns a complaint
   * about a thin page into a deliberate exclusion.
   *
   * `follow` stays on: the links out of this page are real pages, and there is
   * no reason to stop a crawler walking them just because it should not keep
   * the room it walked through.
   */
  robots: { index: false, follow: true },
};

export default function ProfilePage() {
  return <ProfileDashboard />;
}
