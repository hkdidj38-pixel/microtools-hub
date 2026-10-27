import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export const FAVORITES_STORAGE_KEY = 'favoriteTools';
export const RECENT_STORAGE_KEY = 'recentTools';
const LOCAL_PULSE_EVENT = 'microtools:local-pulse';
const MAX_RECENT = 8;
const EMPTY_ARRAY: string[] = [];

let favoritesCache: string[] | null = null;
let recentsCache: string[] | null = null;
const listeners = new Set<() => void>();

function readStorageArray(key: string): string[] {
  if (typeof window === 'undefined') return EMPTY_ARRAY;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_ARRAY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_ARRAY;
    const filtered = parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    return filtered.length > 0 ? filtered : EMPTY_ARRAY;
  } catch {
    return EMPTY_ARRAY;
  }
}

function persistBestEffort(key: string, values: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Storage may be blocked or full; in-memory state remains authoritative for this session.
  }
}

function emitStoreChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getFavoritesSnapshot(): string[] {
  if (favoritesCache === null) {
    favoritesCache = readStorageArray(FAVORITES_STORAGE_KEY);
  }
  return favoritesCache;
}

function getRecentsSnapshot(): string[] {
  if (recentsCache === null) {
    recentsCache = readStorageArray(RECENT_STORAGE_KEY);
  }
  return recentsCache;
}

function getServerSnapshot(): string[] {
  return EMPTY_ARRAY;
}

function onWindowStorage(event: StorageEvent): void {
  if (event.key === null || event.key === FAVORITES_STORAGE_KEY) {
    favoritesCache = readStorageArray(FAVORITES_STORAGE_KEY);
    emitStoreChange();
  }
  if (event.key === null || event.key === RECENT_STORAGE_KEY) {
    recentsCache = readStorageArray(RECENT_STORAGE_KEY);
    emitStoreChange();
  }
}

function subscribePreferences(listener: () => void): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(listener);

  if (typeof window !== 'undefined' && wasEmpty) {
    window.addEventListener('storage', onWindowStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined' && listeners.size === 0) {
      window.removeEventListener('storage', onWindowStorage);
    }
  };
}

export function toggleFavoriteSlug(slug: string): string[] {
  const current = getFavoritesSnapshot();
  const exists = current.includes(slug);
  const next = exists ? current.filter((item) => item !== slug) : [slug, ...current];
  favoritesCache = next.length > 0 ? next : EMPTY_ARRAY;
  persistBestEffort(FAVORITES_STORAGE_KEY, favoritesCache);
  emitStoreChange();
  return favoritesCache;
}

export function recordRecentSlug(slug: string): string[] {
  const current = getRecentsSnapshot();
  const next = [slug, ...current.filter((item) => item !== slug)].slice(0, MAX_RECENT);
  if (next.length === current.length && next.every((val, idx) => val === current[idx])) {
    return current;
  }
  recentsCache = next;
  persistBestEffort(RECENT_STORAGE_KEY, recentsCache);
  emitStoreChange();
  return recentsCache;
}

export function useToolPreferences() {
  const favoriteTools = useSyncExternalStore(
    subscribePreferences,
    getFavoritesSnapshot,
    getServerSnapshot,
  );
  const recentTools = useSyncExternalStore(
    subscribePreferences,
    getRecentsSnapshot,
    getServerSnapshot,
  );

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
