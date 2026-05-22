package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Focused tests for the tracking-host / rejected-path filter inside
 * RaceOfficialImageService (isRejectedResolvedImage), exercised via the
 * public resolveOfficialImage API.
 */
class RaceOfficialImageFilterTests {

    private RaceOfficialImageService serviceWithHtml(String pageUrl, String html) {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(eq(pageUrl), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        return new RaceOfficialImageService(restTemplate);
    }

    // --- tracking host rejections ---

    @Test
    void rejectsTrackingHostTrLineMeDotMe() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://tr.line.me/tracking.gif\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsGoogleAnalyticsHost() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://www.google-analytics.com/collect?v=1\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsGoogleTagManagerHost() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://www.googletagmanager.com/gtag/js?id=GA_ID\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsDoubleClickNetHost() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://ad.doubleclick.net/dot.gif\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsFacebookTrackerHost() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://www.facebook.com/tr?id=1496628597147696&ev=PageView&noscript=1\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    // --- tracking path rejections ---

    @Test
    void rejectsNextImageProxyPath() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://example.com/_next/image?url=%2Frace.jpg&w=128\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsTagGifPath() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://cdn.example.com/tag.gif\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsPixelPath() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://example.com/pixel?id=1\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsBeaconPath() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://example.com/beacon?t=1\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsNoscriptTrackerPath() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://cdn.example.com/tracker?ev=PageView&noscript=1\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void rejectsSocialBrandingImagePattern() {
        String pageUrl = "https://aucklandmarathon.co.nz/";
        String html = "<meta property=\"og:image\" content=\"https://aucklandmarathon.co.nz/assets/Uploads/Auckland-Marathon-FB.jpg\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    // --- normal images pass through ---

    @Test
    void acceptsNormalCdnImage() {
        String pageUrl = "https://example.com/race";
        String html = "<img src=\"https://cdn.example.com/race-hero.jpg\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl))
                .isEqualTo("https://cdn.example.com/race-hero.jpg");
    }

    @Test
    void acceptsOgImageMetaTag() {
        String pageUrl = "https://example.com/race";
        String html = "<meta property=\"og:image\" content=\"https://cdn.example.com/og-banner.jpg\" />";
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl))
                .isEqualTo("https://cdn.example.com/og-banner.jpg");
    }

    @Test
    void skipsRejectedTrackingHostAndFallsBackToLaterValidImage() {
        String pageUrl = "https://example.com/race";
        String html = """
                <img src="https://tr.line.me/pixel.gif" />
                <img src="https://cdn.example.com/valid-photo.jpg" />
                """;
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl))
                .isEqualTo("https://cdn.example.com/valid-photo.jpg");
    }

    @Test
    void returnsNullWhenAllCandidatesAreTrackers() {
        String pageUrl = "https://example.com/race";
        String html = """
                <img src="https://tr.line.me/pixel.gif" />
                <img src="https://www.google-analytics.com/collect" />
                """;
        assertThat(serviceWithHtml(pageUrl, html).resolveOfficialImage(pageUrl)).isNull();
    }

    @Test
    void returnsNullForNullPageUrl() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceOfficialImageService service = new RaceOfficialImageService(restTemplate);
        assertThat(service.resolveOfficialImage(null)).isNull();
    }

    @Test
    void returnsNullForEmptyPageUrl() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceOfficialImageService service = new RaceOfficialImageService(restTemplate);
        assertThat(service.resolveOfficialImage("")).isNull();
    }
}
