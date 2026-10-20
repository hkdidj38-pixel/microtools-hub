import React, { lazy } from 'react';

export interface ToolFAQ {
  q: string;
  a: string;
}

export interface ToolMeta {
  slug: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  faqs: ToolFAQ[];
}

export interface RegisteredTool extends ToolMeta {
  Component: React.LazyExoticComponent<React.ComponentType>;
}

const metaModules = import.meta.glob<{ meta: ToolMeta }>('../tools/*/meta.ts', { eager: true });
const uiModules = import.meta.glob<{ default: React.ComponentType }>('../tools/*/index.tsx');

export const TOOLS_REGISTRY: RegisteredTool[] = Object.entries(metaModules)
  .map(([modulePath, mod]) => {
    const match = modulePath.match(/\.\.\/tools\/([^/]+)\/meta\.ts$/);
    const folder = match?.[1] ?? '';
    if (!folder || folder.startsWith('_') || !mod?.meta) return null;

    const loader = uiModules[`../tools/${folder}/index.tsx`];
    if (!loader) return null;

    return {
      ...mod.meta,
      slug: mod.meta.slug || folder,
      Component: lazy(loader),
    };
  })
  .filter((item): item is RegisteredTool => item !== null)
  .sort((a, b) => a.name.localeCompare(b.name));
