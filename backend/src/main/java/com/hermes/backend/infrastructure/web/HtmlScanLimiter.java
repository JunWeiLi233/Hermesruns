package com.hermes.backend.infrastructure.web;

/**
 * Caps how much untrusted remote HTML / GPX the race image, elevation and
 * course-map scrapers will scan. Image tokens (og:image, &lt;img&gt;, murl)
 * live near the top of a document, so anything past this cap is a download
 * or an abusive response. The cap bounds total work only; it does not make a
 * superlinear regex safe, which is why tag scraping goes through
 * {@link HtmlTagScanner}.
 */
public final class HtmlScanLimiter {
    /**
     * Generous upper bound for the region we are willing to scan. Real race
     * sites stay well under this.
     */
    public static final int MAX_HTML_SCAN_BYTES = 2_000_000;

    private HtmlScanLimiter() {}

    /**
     * @return {@code html} truncated to {@link #MAX_HTML_SCAN_BYTES}, or
     *         {@code html} unchanged when it is already within the limit.
     */
    public static String bounded(String html) {
        if (html == null || html.length() <= MAX_HTML_SCAN_BYTES) {
            return html;
        }
        return html.substring(0, MAX_HTML_SCAN_BYTES);
    }
}
