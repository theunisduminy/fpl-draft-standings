// Libraries
import { Inter } from 'next/font/google';
import clsx from 'clsx';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Components and Style
import '../styles/globals.css';
import Footer from '../components/Footer';
import HeaderNav from '../components/HeaderNav';
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
    template: '%s - Salty Spur Draft Standings',
    default: `FPL Standings`,
  },
  description: `A better way to get who is the best`,
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://draftrank.vercel.app',
    siteName: 'Draft Standings',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: 'white',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      className={clsx(`h-full ${bgGradient} from-30% antialiased scroll-smooth`, inter.variable)}
    >
      <body className='flex min-h-full flex-col font-inter'>
        <HeaderNav />
        <div className='flex flex-col'>{children}</div>
        <Analytics />
        <SpeedInsights />
        <Footer />
      </body>
    </html>
  );
}
