package com.hermes.backend.infrastructure.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Linear-time extraction of start tags from untrusted HTML / XML.
 *
 * <p>The scraping services used to run patterns such as
 * {@code <img[^>]+src=["']([^"']+)["'][^>]*>} over whole remote documents.
 * Every {@code <img} start re-scans to the next {@code >}, so a page made of
 * unterminated tags costs O(n^2) backtracking: 100 KB of {@code "<img x"}
 * already takes ~13 s, and the 2 MB {@link HtmlScanLimiter} cap does not stop
 * that ({@code java/polynomial-redos}). This scanner walks the document once,
 * hands back each matching tag (bounded by {@link #MAX_TAG_LENGTH}), and the
 * callers then read attributes with patterns that have no ambiguous prefix.
 */
public final class HtmlTagScanner {
    /** Longest start tag we read; real img/meta/a/trkpt tags are far shorter. */
    public static final int MAX_TAG_LENGTH = 8_192;

    private static final int MAX_TAG_NAME_LENGTH = 64;

    private HtmlTagScanner() {}

    /**
     * Returns every start tag whose local name (namespace prefix ignored, case
     * insensitive) is in {@code tagNames}, from {@code <} through the closing
     * {@code >}, in document order. Tags longer than {@link #MAX_TAG_LENGTH}
     * are skipped, and scanning stops at the first tag that never closes.
     */
    public static List<String> startTags(String document, Set<String> tagNames) {
        List<String> tags = new ArrayList<>();
        String html = HtmlScanLimiter.bounded(document);
        if (html == null || html.isEmpty()) return tags;
        int from = 0;
        while (from < html.length()) {
            int open = html.indexOf('<', from);
            if (open < 0) break;
            int nameEnd = open + 1;
            while (nameEnd < html.length() && nameEnd - open <= MAX_TAG_NAME_LENGTH && isNameChar(html.charAt(nameEnd))) {
                nameEnd++;
            }
            String name = localName(html.substring(open + 1, nameEnd));
            if (name.isEmpty() || !tagNames.contains(name)) {
                from = nameEnd > open + 1 ? nameEnd : open + 1;
                continue;
            }
            int close = html.indexOf('>', nameEnd);
            if (close < 0) break;
            if (close - open < MAX_TAG_LENGTH) {
                tags.add(html.substring(open, close + 1));
            }
            from = close + 1;
        }
        return tags;
    }

    /**
     * Returns the last value captured by group 1 of {@code attributePattern}
     * within {@code tag}, or {@code null}. "Last" mirrors the greedy
     * {@code [^>]+} prefix of the old whole-document patterns, so
     * {@code <img src="placeholder.gif" data-src="real.jpg">} still yields the
     * lazy-loaded image.
     */
    public static String lastAttribute(String tag, Pattern attributePattern) {
        if (tag == null) return null;
        Matcher matcher = attributePattern.matcher(tag);
        String last = null;
        while (matcher.find()) {
            last = matcher.group(1);
        }
        return last;
    }

    private static boolean isNameChar(char c) {
        return Character.isLetterOrDigit(c) || c == ':' || c == '_' || c == '-' || c == '.';
    }

    private static String localName(String qualifiedName) {
        int colon = qualifiedName.lastIndexOf(':');
        String local = colon >= 0 ? qualifiedName.substring(colon + 1) : qualifiedName;
        return local.toLowerCase(Locale.ROOT);
    }
}
