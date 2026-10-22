package com.hermes.backend.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class HtmlTagScannerTests {
    private static final Pattern SRC = Pattern.compile("src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);

    @Test
    void returnsMatchingStartTagsInDocumentOrder() {
        String html = "<p>intro</p><IMG src=\"a.png\"><a href='/x'>x</a><img alt=\"b\" src='b.jpg' />";

        assertThat(HtmlTagScanner.startTags(html, Set.of("img")))
                .containsExactly("<IMG src=\"a.png\">", "<img alt=\"b\" src='b.jpg' />");
        assertThat(HtmlTagScanner.startTags(html, Set.of("a"))).containsExactly("<a href='/x'>");
    }

    @Test
    void matchesNamespacedTagsByLocalName() {
        String gpx = "<gpx:trkpt lat=\"1\" lon=\"2\"/><trkpts/><rtept lat=\"3\" lon=\"4\">";

        assertThat(HtmlTagScanner.startTags(gpx, Set.of("trkpt", "rtept")))
                .containsExactly("<gpx:trkpt lat=\"1\" lon=\"2\"/>", "<rtept lat=\"3\" lon=\"4\">");
    }

    @Test
    void lastAttributePrefersTheLazyLoadedSource() {
        String tag = "<img src=\"placeholder.gif\" data-src=\"real.jpg\">";

        assertThat(HtmlTagScanner.lastAttribute(tag, SRC)).isEqualTo("real.jpg");
        assertThat(HtmlTagScanner.lastAttribute("<img alt=x>", SRC)).isNull();
    }

    @Test
    void skipsOversizedTagsAndStopsAtAnUnterminatedTag() {
        String oversized = "<img src=\"" + "a".repeat(HtmlTagScanner.MAX_TAG_LENGTH) + "\">";
        String html = oversized + "<img src=\"ok.png\"><img src=\"never-closed.png\"";

        assertThat(HtmlTagScanner.startTags(html, Set.of("img"))).containsExactly("<img src=\"ok.png\">");
    }

    @Test
    void scansHostileDocumentsInLinearTime() {
        // 2 MB of unterminated tags took minutes with the old whole-document
        // <img[^>]+...[^>]*> pattern; the scanner walks it once.
        String unterminated = "<img x".repeat(HtmlScanLimiter.MAX_HTML_SCAN_BYTES / 6);
        String unclosedAttributes = "<img src=\"" + " src=\"a".repeat(HtmlScanLimiter.MAX_HTML_SCAN_BYTES / 8) + ">";

        assertTimeoutPreemptively(Duration.ofSeconds(5), () -> {
            assertThat(HtmlTagScanner.startTags(unterminated, Set.of("img"))).isEmpty();
            List<String> tags = HtmlTagScanner.startTags(unclosedAttributes, Set.of("img"));
            assertThat(tags).isEmpty();
        });
    }
}
