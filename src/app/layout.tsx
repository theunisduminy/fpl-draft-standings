// Libraries
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Components and Style
import './globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

// Fonts & Head
const inter = Inter({
  weight: ['100', '200', '300', '400', '500', '600', '700', '900'],
  style: ['normal'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Metadata
import { type Metadata } from 'next';
import type { Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://draftrank.vercel.app'),
  title: {
    template: '%s - Better Draft | FPL Scoring',
    default: `Better Draft`,
  },
  description: `A better FPL point system`,
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://draftrank.vercel.app',
    siteName: 'Better Draft',
  },
  // No `icons` block on purpose: `src/app/favicon.ico` is picked up by Next's
  // file convention. An explicit override here would win over it, which is how
  // three links to the since-deleted `/public/better-favicon.ico` survived.
};

export const viewport: Viewport = {
  themeColor: '#1a0520',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang='en'
      className={`${inter.variable} h-full scroll-smooth antialiased`}
    >
      <body className='font-inter flex min-h-screen flex-col bg-[#1a0520] text-white antialiased'>
        {/* Navigation is deliberately NOT here — it lives in `AppChrome`, which
            `(app)/layout.tsx` wraps every real page in. `/auth/sign-in` renders
            against this layout alone, so a signed-out visitor gets the fonts,
            the background and nothing to click but the sign-in button. */}
        {children}

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
