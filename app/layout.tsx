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

export const metadata: Metadata = {
  title: 'KeyMania — type fast, strike hard',
  description:
    'A real-time typing duel. Every word you finish forges a blade and throws it at your opponent.',
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
