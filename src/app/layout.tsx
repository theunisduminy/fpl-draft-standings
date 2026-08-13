// Libraries
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Components and Style
import './globals.css';
import Footer from '@/components/Layout/Footer';
import HeaderNav from '@/components/Layout/HeaderNav';
import MobileNav from '@/components/Layout/MobileNav';
import { SideNav } from '@/components/Layout/SideNav';
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
        {/* Three navigation surfaces, each owning one breakpoint band:
            HeaderNav is the brand bar below `lg`, MobileNav the bottom bar
            below `md`, and SideNav the floating panel from `lg` up. */}
        <HeaderNav />
        <SideNav />

        <main className='flex-1 pt-4 pb-20 md:pt-8 md:pb-8 lg:pt-4 lg:pl-64'>
          <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'>
            {children}
          </div>
        </main>

        <Footer />
        <MobileNav />

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
