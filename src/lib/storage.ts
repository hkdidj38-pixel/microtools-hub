import { useCallback, useEffect, useRef, useState } from 'react';

export const FAVORITES_STORAGE_KEY = 'favoriteTools';
export const RECENT_STORAGE_KEY = 'recentTools';
const STORAGE_SYNC_EVENT = 'microtools:storage-sync';
const LOCAL_PULSE_EVENT = 'microtools:local-pulse';
const MAX_RECENT = 8;

function readStringArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT));
  } catch {
    // Ignore quota or disabled-storage errors cleanly.
  }
}

export function toggleFavoriteSlug(slug: string): string[] {
  const current = readStringArray(FAVORITES_STORAGE_KEY);
  const exists = current.includes(slug);
  const next = exists ? current.filter((item) => item !== slug) : [slug, ...current];
  writeStringArray(FAVORITES_STORAGE_KEY, next);
  return next;
}

export function recordRecentSlug(slug: string): string[] {
  const current = readStringArray(RECENT_STORAGE_KEY);
  const next = [slug, ...current.filter((item) => item !== slug)].slice(0, MAX_RECENT);
  writeStringArray(RECENT_STORAGE_KEY, next);
  return next;
}

export function useToolPreferences() {
  const [favoriteTools, setFavoriteTools] = useState<string[]>(() => readStringArray(FAVORITES_STORAGE_KEY));
  const [recentTools, setRecentTools] = useState<string[]>(() => readStringArray(RECENT_STORAGE_KEY));

  useEffect(() => {
    const sync = () => {
      setFavoriteTools(readStringArray(FAVORITES_STORAGE_KEY));
      setRecentTools(readStringArray(RECENT_STORAGE_KEY));
    };
    window.addEventListener(STORAGE_SYNC_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STORAGE_SYNC_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleFavorite = useCallback((slug: string) => {
    toggleFavoriteSlug(slug);
  }, []);

  const markRecent = useCallback((slug: string) => {
    recordRecentSlug(slug);
  }, []);

  return {
    favoriteTools,
    recentTools,
    toggleFavorite,
    markRecent,
  };
}

export function emitLocalActivityPulse(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCAL_PULSE_EVENT));
}

export function useLocalActivityPulse(holdMs = 650): boolean {
  const [active, setActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePulse = () => {
      setActive(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setActive(false);
      }, holdMs);
    };
    window.addEventListener(LOCAL_PULSE_EVENT, handlePulse);
    return () => {
      window.removeEventListener(LOCAL_PULSE_EVENT, handlePulse);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [holdMs]);

  return active;
}
