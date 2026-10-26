import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Menu, ShieldCheck, X } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';
import { focusFragmentTarget } from '@/lib/navigation';
import { BrandMark } from '@/components/BrandMark';

interface SiteHeaderProps {
  variant: 'home' | 'tool';
  privacy?: ToolMeta['privacy'];
}

const sectionLinks = [
  { label: 'Explore tools', id: 'toolbox' },
  { label: 'Classic utilities', id: 'classic-tools' },
  { label: 'Privacy & data', id: 'privacy' },
] as const;

export function SiteHeader({ variant, privacy }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isHome = variant === 'home';

  const privacyBadge = privacy && (
    <span
      className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium leading-tight tracking-tight ${
        privacy.mode === 'edge'
          ? 'border-peach-ink/25 bg-peach text-peach-ink'
          : 'border-brand/20 bg-sage text-brand-dark'
      }`}
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{privacy.label}</span>
    </span>
  );

  const closeMenu = (restoreFocus = false) => {
    setIsMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        menuButtonRef.current?.focus();
      });
    }
  };

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && isMenuOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const renderSectionLink = (
    item: (typeof sectionLinks)[number],
    className: string,
    onClick?: () => void,
    trailing?: React.ReactNode,
  ) => (
    isHome ? (
      <a key={item.id} href={`#${item.id}`} onClick={onClick} className={className}>
        <span>{item.label}</span>
        {trailing}
      </a>
    ) : (
      <Link key={item.id} to={`/#${item.id}`} onClick={onClick} className={className}>
        <span>{item.label}</span>
        {trailing}
      </Link>
    )
  );

  return (
    <header
      className="sticky top-0 z-40 border-b border-line/90 bg-paper/90 backdrop-blur-xl"
      onKeyDown={handleHeaderKeyDown}
    >
      <nav
        className="hub-container flex min-h-16 items-center justify-between gap-3 sm:min-h-[4.5rem]"
        aria-label="Main navigation"
      >
        <Link
          to="/"
          className="group inline-flex min-h-11 min-w-0 shrink-0 items-center gap-2.5 rounded-xl pr-1 sm:gap-3"
          aria-label="MicroTools Hub home"
        >
          <BrandMark />
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-base font-extrabold tracking-[-0.03em] text-ink sm:text-lg">
              MicroTools<span className="text-brand">.</span>
            </span>
            <span
              className="hidden rounded-full border border-line bg-white/80 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted sm:inline-block"
              aria-hidden="true"
            >
              Hub
            </span>
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 lg:flex xl:gap-2.5">
            {sectionLinks.slice(0, isHome ? 2 : 3).map((item) =>
              renderSectionLink(
                item,
                'rounded-xl px-3 py-2 text-sm font-semibold text-muted transition-colors duration-fast ease-standard hover:bg-sage/55 hover:text-ink',
              ),
            )}
            {isHome ? (
              <a
                href="#privacy"
                className="ml-1 inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/25 bg-white px-4 py-2 text-xs font-bold tracking-tight text-ink shadow-sm transition-colors duration-fast ease-standard hover:border-brand hover:bg-sage/60 hover:text-brand-dark"
              >
                <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
                <span>Privacy first</span>
              </a>
            ) : (
              <div className="ml-1">{privacyBadge}</div>
            )}
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            data-site-menu-toggle="true"
            className="hub-button-secondary min-h-11 min-w-11 gap-2 px-3 text-xs lg:hidden"
            aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden min-[360px]:inline">{isMenuOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </nav>

      <div id="site-mobile-navigation" className="hub-container pb-3.5 lg:hidden" hidden={!isMenuOpen}>
        {!isHome && privacyBadge && <div className="mb-2">{privacyBadge}</div>}
        <nav
          aria-label="Mobile navigation"
          className="hub-mobile-menu grid gap-1 rounded-2xl border border-line bg-white p-2 shadow-soft motion-safe:animate-hub-menu-in"
        >
          {sectionLinks.map((item) =>
            renderSectionLink(
              item,
              'flex min-h-11 items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors duration-fast ease-standard hover:bg-sage/65 hover:text-brand-dark active:bg-paper',
              () => {
                closeMenu();
                if (isHome) {
                  const isRepeatedFragment = window.location.hash === `#${item.id}`;
                  window.requestAnimationFrame(() => {
                    const target = document.getElementById(item.id);
                    if (!target) return;
                    focusFragmentTarget(target);
                    target.scrollIntoView({ block: 'start', behavior: isRepeatedFragment ? 'instant' : 'auto' });
                  });
                }
              },
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />,
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
