import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

interface SiteFooterProps {
  variant: 'home' | 'tool';
}

export function SiteFooter({ variant }: SiteFooterProps) {
  const isHome = variant === 'home';

  return (
    <footer className="border-t border-line bg-white/85 backdrop-blur-sm">
      <div className="hub-container py-8 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <BrandMark size="sm" />
              <p className="text-sm font-extrabold tracking-tight text-ink">
                MicroTools Hub{' '}
                <span className="font-normal text-muted">· Thoughtful little tools for everyday work.</span>
              </p>
            </div>
            <p className="mt-2.5 max-w-xl text-xs leading-5 text-muted">
              File, media, and text utilities run locally in your browser without uploads or analytics. URL metadata inspection uses a disclosed Cloudflare edge fetch.
            </p>
          </div>

          {isHome ? (
            <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-muted">
              <a href="#toolbox" className="rounded-md py-1 transition-colors hover:text-brand-dark">
                The toolkit
              </a>
              <a href="#classic-tools" className="rounded-md py-1 transition-colors hover:text-brand-dark">
                Classic utilities
              </a>
              <a href="#privacy" className="rounded-md py-1 transition-colors hover:text-brand-dark">
                Privacy &amp; data
              </a>
            </nav>
          ) : (
            <Link
              to="/#toolbox"
              className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-2 text-xs font-bold text-brand-dark transition-colors hover:border-brand/35 hover:bg-sage/60"
            >
              Back to all tools <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
