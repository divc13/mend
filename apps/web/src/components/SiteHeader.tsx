'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark, ChevronDown, Menu, X } from './Icons';

const primary = [
  { href: '/', label: 'Map' },
  { href: '/report', label: 'Report a problem' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/live', label: 'Live' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/trust', label: 'Trust' },
];

const consoles = [
  { href: '/demo', label: 'Demo control room' },
  { href: '/steward', label: 'Steward console' },
  { href: '/bids/WO-BENCH-001-0001', label: 'Sealed bid room' },
  { href: '/inspector/WO-GATE-006-0001', label: 'Inspector console' },
  { href: '/sponsor/WO-BENCH-001-0001', label: 'Sponsor & Intents' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand__text">
            <span className="brand__name">MEND</span>
            <span className="brand__tag">Maintenance with memory</span>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
          <span>{open ? 'Close menu' : 'Menu'}</span>
        </button>

        <nav id="primary-navigation" className={`site-nav${open ? ' site-nav--open' : ''}`} aria-label="Primary">
          {primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav__link${isActive(pathname, item.href) ? ' is-active' : ''}`}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}

          <details className="nav-details">
            <summary className="site-nav__link nav-details__summary">
              Consoles <ChevronDown size={15} />
            </summary>
            <div className="nav-details__panel">
              {consoles.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-details__link${isActive(pathname, item.href) ? ' is-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>

          <Link href="/report" className="button button--small nav-cta">
            Report without a wallet
          </Link>
        </nav>
      </div>
    </header>
  );
}
