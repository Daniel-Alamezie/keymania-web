import type { Metadata } from 'next';
import { Press_Start_2P, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Analytics from '@/components/Analytics';
import TrackPath from '@/components/TrackPath';
import InviteHost from '@/components/InviteHost';

const pixel = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});

const body = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

/**
 * One canonical home: keymania.app.
 *
 * `metadataBase` plus the canonical alternate is what tells Google the two
 * hosts serving this game are one site — without it, keymania.app and the
 * vercel.app domain split their rank between them and both lose. The share
 * image is the brand lockup regenerated from the header's own styling, so a
 * link pasted into Discord or Reddit shows the game's actual face.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://keymania.app'),
  alternates: { canonical: '/' },
  /**
   * Search Console, via the meta tag.
   *
   * The domain property is verified by DNS TXT and this does not replace it —
   * it verifies the URL-prefix property as well, which is the one that reports
   * per-page performance. Not a secret: the same token is published in DNS for
   * anybody to read.
   */
  verification: { google: 'duvYI8nbtED1XNGCzc-aiQK4iVVfXg948RR4IrVTHz8' },
  title: 'KeyMania — type fast, strike hard',
  description:
    'A real-time typing duel. Every word you finish forges a blade and throws it at your opponent.',
  openGraph: {
    title: 'KeyMania — type fast, strike hard',
    description:
      'A real-time typing duel. Every word you finish forges a blade and throws it at your opponent.',
    url: 'https://keymania.app',
    siteName: 'KeyMania',
    /**
     * 1200x630, the frame every platform crops to.
     *
     * The banner wordmark is 1093x347 and was getting letterboxed or
     * centre-cropped — usually losing the tagline. This card is composed into
     * the 1.91:1 frame instead of salvaged from a wider one, and carries one
     * line of what the game is, because a shared link is often the only pitch
     * anybody reads.
     */
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'KeyMania — type fast, strike hard' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KeyMania — type fast, strike hard',
    description: 'A real-time typing duel. Type fast, strike hard.',
    images: ['/brand/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable}`}>
      {/* No Kinde provider needed: useKindeBrowserClient resolves the session
          on its own, so the layout stays a plain server component. */}
      <body>
        {/* Renders nothing; it exists to start analytics and follow the route.
            Inert unless a PostHog key is configured — see game/analytics.ts. */}
        <Analytics />
        <TrackPath />
        {/* The heartbeat and the invite toast, above every route. See
            InviteHost for why they cannot live inside a page. */}
        <InviteHost />
        {children}
      </body>
    </html>
  );
}
