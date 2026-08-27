const RASTER_DATA_IMAGE_PATTERN = /^data:image\/(?:bmp|gif|jpe?g|png|webp);base64,[a-z0-9+/]+={0,2}$/i;

/**
 * Keep user- and provider-supplied image URLs inside protocols the browser can
 * render as images without allowing scriptable schemes or protocol-relative
 * redirects to another origin.
 */
export function getSafeImageUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (RASTER_DATA_IMAGE_PATTERN.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return '';

  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === 'https:') return parsed.href;
    if (parsed.protocol === 'http:' && parsed.origin === window.location.origin) return parsed.href;
    if (parsed.protocol === 'blob:') return parsed.href;
    if (parsed.origin === window.location.origin && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return '';
  }

  return '';
}
