import type { Metadata } from 'next';
import { Press_Start_2P, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Analytics from '@/components/Analytics';

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
  title: 'KeyMania — type fast, strike hard',
  description:
    'A real-time typing duel. Every word you finish forges a blade and throws it at your opponent.',
  openGraph: {
    title: 'KeyMania — type fast, strike hard',
    description:
      'A real-time typing duel. Every word you finish forges a blade and throws it at your opponent.',
    url: 'https://keymania.app',
    siteName: 'KeyMania',
    images: [{ url: '/brand/keymania-wordmark-tagline.png', width: 1093, height: 347 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KeyMania — type fast, strike hard',
    description: 'A real-time typing duel. Type fast, strike hard.',
    images: ['/brand/keymania-wordmark-tagline.png'],
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
        {children}
      </body>
    </html>
  );
}
