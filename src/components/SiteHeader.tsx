import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';

interface SiteHeaderProps {
  variant: 'home' | 'tool';
  privacy?: ToolMeta['privacy'];
}

const sectionLinks = [
  { label: 'Explore tools', id: 'toolbox' },
  { label: 'Classic utilities', id: 'classic-tools' },
  { label: 'Privacy & data', id: 'privacy' },
] as const;

const menuButtonSelector = '[data-site-menu-toggle="true"]';

export function SiteHeader({ variant, privacy }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isHome = variant === 'home';
  const privacyBadge = privacy && (
    <span className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold leading-tight ${privacy.mode === 'edge' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-brand/20 bg-brand-soft text-brand-dark'}`}>
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{privacy.label}</span>
    </span>
  );

  const closeMenu = (restoreFocus = false) => {
    setIsMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(menuButtonSelector)?.focus();
      });
    }
  };

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && isMenuOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const renderSectionLink = (item: (typeof sectionLinks)[number], className: string, onClick?: () => void) => (
    isHome
      ? <a key={item.id} href={`#${item.id}`} onClick={onClick} className={className}>{item.label}</a>
      : <Link key={item.id} to={`/#${item.id}`} onClick={onClick} className={className}>{item.label}</Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-xl" onKeyDown={handleHeaderKeyDown}>
      <nav className="hub-container flex min-h-16 items-center justify-between gap-3 sm:min-h-[4.5rem]" aria-label="Main navigation">
        <Link to="/" className="group inline-flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl sm:gap-3" aria-label="MicroTools Hub home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-lime shadow-sm transition-transform duration-fast ease-standard group-hover:-rotate-6 sm:h-10 sm:w-10 sm:rounded-2xl">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-extrabold tracking-tight text-ink sm:text-lg">MicroTools<span className="text-brand">.</span></span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 lg:flex xl:gap-5">
            {sectionLinks.slice(0, isHome ? 2 : 3).map((item) => renderSectionLink(
              item,
              'rounded-lg px-2 py-2 text-sm font-semibold text-muted transition-colors duration-fast ease-standard hover:text-brand',
            ))}
            {isHome ? (
              <a href="#privacy" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition-colors duration-fast ease-standard hover:border-brand/40 hover:text-brand">
                <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" /> Privacy first
              </a>
            ) : privacyBadge}
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

      <div id="site-mobile-navigation" className="hub-container pb-3 lg:hidden" hidden={!isMenuOpen}>
        {!isHome && privacyBadge && <div className="mb-2">{privacyBadge}</div>}
        <nav aria-label="Mobile navigation" className="hub-mobile-menu grid gap-1 rounded-2xl border border-line bg-white p-2 shadow-soft motion-safe:animate-hub-menu-in">
          {sectionLinks.map((item) => renderSectionLink(
            item,
            'flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition-colors duration-fast ease-standard hover:bg-brand-soft hover:text-brand active:bg-paper',
            () => closeMenu(true),
          ))}
        </nav>
      </div>
    </header>
  );
}
