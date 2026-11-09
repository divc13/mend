import Link from 'next/link';
import { BrandMark } from './Icons';
import { FIXTURE_VERSION } from '@/lib/fixtures';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <Link href="/" className="brand brand--footer">
            <BrandMark size={32} />
            <span className="brand__text">
              <span className="brand__name">MEND</span>
              <span className="brand__tag">Get it fixed. Keep it fixed.</span>
            </span>
          </Link>
          <p>
            Community maintenance with a memory. Repairs stay attached to the asset, the warranty and the people who
            made the decision.
          </p>
          <p className="site-footer__micro">
            No wallet required to report. No private evidence URL or precise location is shown publicly.
          </p>
        </div>

        <nav className="site-footer__col" aria-label="Product">
          <h2>Product</h2>
          <Link href="/">Public map</Link>
          <Link href="/report">Report a problem</Link>
          <Link href="/dashboard">Public dashboard</Link>
          <Link href="/trust">Privacy & trust</Link>
        </nav>

        <nav className="site-footer__col" aria-label="Consoles">
          <h2>Consoles</h2>
          <Link href="/steward">Steward console</Link>
          <Link href="/bids/WO-BENCH-001-0001">Sealed bid room</Link>
          <Link href="/inspector/WO-GATE-006-0001">Inspector console</Link>
          <Link href="/sponsor/WO-BENCH-001-0001">Sponsor & Intents</Link>
        </nav>

        <div className="site-footer__col">
          <h2>Modes</h2>
          <p className="footer-mode">REPLAY / SIMULATION</p>
          <p className="footer-mode">LIVE TESTNET — TEST VALUE ONLY</p>
          <p className="footer-mode footer-mode--locked">MAINNET — REAL FUNDS · locked</p>
          <p className="site-footer__micro">
            Mainnet is never selectable from the demo UI. Every real-funds action needs separate human approval.
          </p>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>© 2026 MEND. Non-speculative maintenance passports. Not legal ownership of a physical asset.</p>
        <p className="mono">{FIXTURE_VERSION}</p>
      </div>
    </footer>
  );
}
