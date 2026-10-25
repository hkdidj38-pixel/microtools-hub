import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';

interface SiteHeaderProps {
  variant: 'home' | 'tool';
  privacy?: ToolMeta['privacy'];
}

export function SiteHeader({ variant, privacy }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isHome = variant === 'home';
  const links = [
    { label: 'Explore tools', to: isHome ? '#toolbox' : '/#toolbox' },
    { label: 'Classic utilities', to: isHome ? '#classic-tools' : '/#classic-tools' },
    { label: 'Privacy & data', to: isHome ? '#privacy' : '/#privacy' },
  ];
  const privacyBadge = privacy && (
    <span className={`inline-flex min-h-9 max-w-[53vw] items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold leading-tight sm:text-xs ${privacy.mode === 'edge' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-brand/20 bg-brand-soft text-brand-dark'}`}>
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{privacy.label}</span>
    </span>
  );

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && isMenuOpen) {
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-xl" onKeyDown={handleHeaderKeyDown}>
      <nav className="hub-container flex min-h-16 items-center justify-between gap-3 sm:min-h-[4.5rem]" aria-label="Main navigation">
        <Link to="/" viewTransition className="group inline-flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl sm:gap-3" aria-label="MicroTools Hub home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-lime shadow-sm transition-transform duration-fast ease-standard group-hover:-rotate-6 sm:h-10 sm:w-10 sm:rounded-2xl">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-extrabold tracking-tight text-ink sm:text-lg">MicroTools<span className="text-brand">.</span></span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <div className="hidden items-center gap-5 lg:flex">
            {(isHome ? links.slice(0, 2) : links).map((item) => (
              <Link key={item.to} to={item.to} viewTransition className="rounded-lg px-2 py-2 text-sm font-semibold text-muted transition-colors duration-fast ease-standard hover:text-brand">
                {item.label}
              </Link>
            ))}
            {isHome ? (
              <Link to="#privacy" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition-colors duration-fast ease-standard hover:border-brand/40 hover:text-brand">
                <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" /> Privacy first
              </Link>
            ) : privacyBadge}
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="hub-button-secondary min-h-11 gap-2 px-3 text-xs lg:hidden"
            aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            <span>{isMenuOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </nav>

      <div id="site-mobile-navigation" className="hub-container pb-3 lg:hidden" hidden={!isMenuOpen}>
        {!isHome && privacyBadge && <div className="mb-2">{privacyBadge}</div>}
        <nav aria-label="Mobile navigation" className="hub-mobile-menu grid gap-1 rounded-2xl border border-line bg-white p-2 shadow-soft motion-safe:animate-hub-menu-in">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              viewTransition
              onClick={() => {
                setIsMenuOpen(false);
                menuButtonRef.current?.focus();
              }}
              className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition-colors duration-fast ease-standard hover:bg-brand-soft hover:text-brand active:bg-paper"
            >
              {item.label}<span aria-hidden="true" className="text-brand">↗</span>
            </Link>
          ))}
          {isHome && privacy && (
            <p className="border-t border-line px-3 py-2 text-xs leading-5 text-muted">
              Image, PDF, media and text processing stays in your browser; URL inspection uses a disclosed edge request.
            </p>
          )}
        </nav>
      </div>
    </header>
  );
}
