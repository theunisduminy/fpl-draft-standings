// Libraries
import { Inter } from 'next/font/google';
import clsx from 'clsx';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Components and Style
import '../styles/globals.css';
import Footer from '@/components/Layout/Footer';
import HeaderNav from '@/components/Layout/HeaderNav';
import { bgGradient } from '@/utils/tailwindVars';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
config.autoAddCss = false;

// Fonts & Head
const inter = Inter({
  weight: ['100', '200', '300', '400', '600', '900'],
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
  icons: {
    icon: '/better-favicon.ico',
    shortcut: '/better-favicon.ico',
    apple: '/better-favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: 'white',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang='en'
      className={clsx(
        `h-full ${bgGradient} scroll-smooth from-30% antialiased`,
        inter.variable,
      )}
    >
      <body className={`font-inter flex min-h-full flex-col bg-transparent`}>
        <HeaderNav />
        <div className='flex flex-1 flex-col'>{children}</div>
        <Analytics />
        <SpeedInsights />
        <Footer />
      </body>
    </html>
  );
}
