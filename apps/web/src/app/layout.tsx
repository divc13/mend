import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ModeProvider } from '@/components/ModeProvider';
import { ModeBanner } from '@/components/ModeBanner';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import type { Mode } from '@/lib/types';

export const metadata: Metadata = {
  title: {
    default: 'MEND — Maintenance with memory',
    template: '%s · MEND',
  },
  description:
    'MEND is community maintenance with a memory. Report an asset without a wallet, follow a sealed contractor market, and keep the repair, warranty and payment history attached to the asset.',
  applicationName: 'MEND',
  keywords: ['community repair', 'NEAR', 'maintenance passport', 'public assets', 'warranty'],
  openGraph: {
    title: 'MEND — Maintenance with memory',
    description: 'Get it fixed. Keep it fixed.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0e4a39',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiConfigured = Boolean(process.env.MEND_API_BASE_URL);
  const initialMode: Mode =
    apiConfigured && process.env.MEND_MODE === 'LIVE_TESTNET' ? 'LIVE_TESTNET' : 'REPLAY';

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <ModeProvider initialMode={initialMode} apiConfigured={apiConfigured}>
          <div className="site-top">
            <ModeBanner />
            <SiteHeader />
          </div>
          <main id="main" tabIndex={-1} className="main">
            {children}
          </main>
          <SiteFooter />
        </ModeProvider>
      </body>
    </html>
  );
}
