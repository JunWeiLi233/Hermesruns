package com.hermes.backend.races;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.infrastructure.web.HtmlTagScanner;
import com.hermes.backend.infrastructure.web.SafeUrlExecutor;
import com.hermes.backend.infrastructure.web.SafeUrlValidator;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class RaceOfficialImageService {
    private static final int MAX_URL_LENGTH = 500;
    private static final Duration CACHE_TTL = Duration.ofHours(12);
    // Attribute patterns run per tag (see HtmlTagScanner).
    private static final Pattern META_IMAGE_PROPERTY_PATTERN = Pattern.compile(
            "(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"']",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern META_CONTENT_PATTERN = Pattern.compile("content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMG_SRC_PATTERN = Pattern.compile("src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final List<String> REJECT_HINTS = List.of("logo", "icon", "badge", "sprite", "favicon", "-fb.");
    private static final List<String> REJECT_HOST_HINTS = List.of(
            "tr.line.me",
            "google-analytics.com",
            "googletagmanager.com",
            "doubleclick.net",
            "facebook.com"
    );
    private static final List<String> REJECT_PATH_HINTS = List.of(
            "/_next/image",
            "tag.gif",
            "pixel",
            "beacon",
            "noscript"
    );

    private final SafeUrlExecutor safeUrlExecutor;
    private final TtlCacheStore cacheStore;

    @Autowired
    public RaceOfficialImageService(SafeUrlExecutor safeUrlExecutor, TtlCacheStore cacheStore) {
        this.safeUrlExecutor = safeUrlExecutor;
        this.cacheStore = cacheStore;
    }

    public RaceOfficialImageService(RestTemplate restTemplate) {
        this(SafeUrlExecutor.permissiveForTests(restTemplate), TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    public String resolveOfficialImage(String websiteUrl) {
        String safeWebsite = SafeUrlValidator.validateHttpUrlOrNull(websiteUrl, MAX_URL_LENGTH, "officialWebsite");
        if (safeWebsite == null) return null;

        CachedImage cached = cacheStore.get("race-official-image", safeWebsite, CachedImage.class).orElse(null);
        if (cached != null) {
            String cachedImage = sanitizeResolvedImage(cached.imageUrl());
            if (cachedImage != null || cached.imageUrl() == null) {
                return cachedImage;
            }
            cacheStore.evict("race-official-image", safeWebsite);
        }

        String resolved = fetchPrimaryImage(safeWebsite);
        cacheStore.put("race-official-image", safeWebsite, new CachedImage(resolved), CACHE_TTL);
        return resolved;
    }

    private String fetchPrimaryImage(String websiteUrl) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.TEXT_HTML, MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT, "HermesRaceImageBot/1.0 (+https://hermes.local)");
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9");

        ResponseEntity<String> response = safeUrlExecutor.exchange(
                websiteUrl,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        if (response == null) return null;
        String html = response.getBody();
        if (html == null || html.isBlank()) return null;

        URI baseUri = URI.create(websiteUrl);
        String metaImage = firstMetaImage(html, baseUri);
        if (metaImage != null) return metaImage;
        return firstInlineImage(html, baseUri);
    }

    private String firstMetaImage(String html, URI baseUri) {
        for (String tag : HtmlTagScanner.startTags(html, Set.of("meta"))) {
            if (!META_IMAGE_PROPERTY_PATTERN.matcher(tag).find()) continue;
            String raw = HtmlTagScanner.lastAttribute(tag, META_CONTENT_PATTERN);
            if (!isMetaImageContent(raw)) continue;
            String image = sanitizeCandidate(raw, baseUri);
            if (image != null) return image;
        }
        return null;
    }

    /** A meta image URL needs a path before any query, and may only carry a fragment after that query. */
    private static boolean isMetaImageContent(String raw) {
        if (raw == null || raw.isEmpty()) return false;
        int query = raw.indexOf('?');
        int hash = raw.indexOf('#');
        if (query < 0) return hash < 0;
        return query > 0 && (hash < 0 || hash > query);
    }

    private String firstInlineImage(String html, URI baseUri) {
        for (String tag : HtmlTagScanner.startTags(html, Set.of("img"))) {
            String image = sanitizeCandidate(HtmlTagScanner.lastAttribute(tag, IMG_SRC_PATTERN), baseUri);
            if (image != null) return image;
        }
        return null;
    }

    private String sanitizeCandidate(String raw, URI baseUri) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.trim();
        if (normalized.startsWith("data:")) return null;

        String lower = normalized.toLowerCase(Locale.ROOT);
        for (String rejectHint : REJECT_HINTS) {
            if (lower.contains(rejectHint)) return null;
        }

        try {
            String resolved = baseUri.resolve(normalized).toString();
            return sanitizeResolvedImage(resolved);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private String sanitizeResolvedImage(String resolved) {
        try {
            String validated = SafeUrlValidator.validateHttpsUrlOrNull(resolved, MAX_URL_LENGTH, "officialImageUrl");
            if (validated == null || isRejectedResolvedImage(validated)) {
                return null;
            }
            return validated;
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private boolean isRejectedResolvedImage(String resolved) {
        try {
            URI uri = URI.create(resolved);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            for (String rejectHost : REJECT_HOST_HINTS) {
                if (host.contains(rejectHost)) {
                    return true;
                }
            }

            String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.ROOT);
            String query = uri.getQuery() == null ? "" : uri.getQuery().toLowerCase(Locale.ROOT);
            String combined = path + (query.isBlank() ? "" : "?" + query);
            for (String rejectPath : REJECT_PATH_HINTS) {
                if (combined.contains(rejectPath)) {
                    return true;
                }
            }
            return false;
        } catch (IllegalArgumentException ignored) {
            return true;
        }
    }

    private record CachedImage(String imageUrl) {
    }
}
