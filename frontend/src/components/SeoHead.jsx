import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useI18n } from '../contexts/I18nContext';
import { getSeoMetadata, SOCIAL_IMAGE_URL, SITE_URL } from '../utils/seoMetadata.js';

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
  element.dataset.hermesSeo = 'true';
}

function updateCanonical(canonicalUrl) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalUrl) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', canonicalUrl);
  element.dataset.hermesSeo = 'true';
}

function updateStructuredData(structuredData) {
  const existing = document.head.querySelector('#hermes-seo-jsonld');
  if (!structuredData) {
    existing?.remove();
    return;
  }
  const element = existing || document.createElement('script');
  element.id = 'hermes-seo-jsonld';
  element.type = 'application/ld+json';
  element.textContent = JSON.stringify(structuredData);
  if (!existing) document.head.appendChild(element);
}

export default function SeoHead() {
  const { pathname } = useLocation();
  const { lang } = useI18n();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const metadata = getSeoMetadata(pathname, lang);
    const pageUrl = metadata.canonicalUrl || `${SITE_URL}${metadata.path}`;

    document.title = metadata.title;
    document.documentElement.lang = metadata.language;
    updateCanonical(metadata.canonicalUrl);
    upsertMeta('name', 'description', metadata.description);
    upsertMeta('name', 'robots', metadata.robots);
    upsertMeta('name', 'author', 'Hermes');
    upsertMeta('property', 'og:type', metadata.openGraphType);
    upsertMeta('property', 'og:url', pageUrl);
    upsertMeta('property', 'og:title', metadata.title);
    upsertMeta('property', 'og:description', metadata.description);
    upsertMeta('property', 'og:locale', metadata.locale);
    upsertMeta('property', 'og:image', SOCIAL_IMAGE_URL);
    upsertMeta('property', 'og:image:alt', metadata.imageAlt);
    upsertMeta('name', 'twitter:title', metadata.title);
    upsertMeta('name', 'twitter:description', metadata.description);
    upsertMeta('name', 'twitter:image', SOCIAL_IMAGE_URL);
    upsertMeta('name', 'twitter:image:alt', metadata.imageAlt);
    upsertMeta('name', 'twitter:url', pageUrl);
    updateStructuredData(metadata.structuredData);
  }, [lang, pathname]);

  return null;
}
