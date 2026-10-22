import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import SeoHead from './SeoHead.jsx';
import { getSeoMetadata } from '../utils/seoMetadata.js';

const language = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../contexts/i18nContextState', () => ({ useI18n: () => language }));

const originalHead = document.head.innerHTML;
const jsonld = () => JSON.parse(document.querySelector('#hermes-seo-jsonld').textContent);
const head = (route) => <MemoryRouter key={route} initialEntries={[route]}><SeoHead /></MemoryRouter>;

beforeEach(() => {
  language.lang = 'en';
  document.head.innerHTML = originalHead;
  const script = document.createElement('script');
  script.id = 'hermes-seo-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(getSeoMetadata('/').structuredData);
  document.head.appendChild(script);
});

afterEach(() => {
  cleanup();
  document.head.innerHTML = originalHead;
  document.documentElement.lang = 'en';
});

describe('structured data after hydration and navigation', () => {
  it('updates the existing server script when language changes without duplicates', () => {
    const serverScript = document.querySelector('#hermes-seo-jsonld');
    const view = render(head('/'));
    expect(jsonld()).toEqual(getSeoMetadata('/', 'en').structuredData);
    language.lang = 'zh-CN';
    view.rerender(head('/'));
    expect(document.querySelector('#hermes-seo-jsonld')).toBe(serverScript);
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(jsonld()).toEqual(getSeoMetadata('/', 'zh-CN').structuredData);
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('replaces app markup with route-specific legal markup and removes it on private routes', () => {
    const view = render(head('/'));
    for (const route of ['/terms', '/privacy']) {
      view.rerender(head(route));
      expect(jsonld()).toEqual(getSeoMetadata(route).structuredData);
      expect(document.querySelector('link[rel="canonical"]').href).toBe(`https://hermesruns.com${route}`);
    }
    view.rerender(head('/login'));
    expect(document.querySelector('#hermes-seo-jsonld')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[name="robots"]').content).toMatch(/^noindex/);
  });
});
