package com.hermes.backend.infrastructure.web;

/**
 * Bounds untrusted HTML before it reaches the polynomial image/meta/href
 * scraping regexes used by the race image / elevation / course-map services.
 *
 * <p>CodeQL's {@code java/polynomial-redos} query fires on those patterns
 * because they run against fully remote, attacker-controlled HTML. A remote
 * page never needs to be unbounded for image scraping (og:image / &lt;img&gt;
 * / murl tokens live near the top of the document), so capping the scanned
 * region both removes the catastrophic-backtracking surface and rejects
 * pathologically large responses cheaply.
 */
public final class HtmlScanLimiter {
    /**
     * Generous upper bound for the HTML region we are willing to scan with the
     * scraping patterns. Real race sites stay well under this; anything larger
     * is either a download or an attempted ReDoS/DoS payload.
     */
    public static final int MAX_HTML_SCAN_BYTES = 2_000_000;

    private HtmlScanLimiter() {}

    /**
     * @return {@code html} truncated to {@link #MAX_HTML_SCAN_BYTES} so the
     *         downstream regex never sees an unbounded input, or {@code html}
     *         unchanged when it is already within the limit.
     */
    public static String bounded(String html) {
        if (html == null || html.length() <= MAX_HTML_SCAN_BYTES) {
            return html;
        }
        return html.substring(0, MAX_HTML_SCAN_BYTES);
    }
}
