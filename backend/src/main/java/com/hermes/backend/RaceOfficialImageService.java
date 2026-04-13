package com.hermes.backend;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RaceOfficialImageService {
    private static final int MAX_URL_LENGTH = 500;
    private static final Duration CACHE_TTL = Duration.ofHours(12);
    private static final Pattern META_IMAGE_PATTERN = Pattern.compile(
            "<meta[^>]+(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"'][^>]+content=[\"']([^\"'#?]+(?:\\?[^\"']*)?)[\"'][^>]*>|"
                    + "<meta[^>]+content=[\"']([^\"'#?]+(?:\\?[^\"']*)?)[\"'][^>]+(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern IMG_PATTERN = Pattern.compile(
            "<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final List<String> REJECT_HINTS = List.of("logo", "icon", "badge", "sprite", "favicon");

    private final RestTemplate restTemplate;
    private final Map<String, CachedImage> cache = new ConcurrentHashMap<>();

    public RaceOfficialImageService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String resolveOfficialImage(String websiteUrl) {
        String safeWebsite = SafeUrlValidator.validateHttpUrlOrNull(websiteUrl, MAX_URL_LENGTH, "officialWebsite");
        if (safeWebsite == null) return null;

        CachedImage cached = cache.get(safeWebsite);
        if (cached != null && !cached.isExpired()) {
          return cached.imageUrl();
        }

        String resolved = fetchPrimaryImage(safeWebsite);
        cache.put(safeWebsite, new CachedImage(resolved, Instant.now().plus(CACHE_TTL)));
        return resolved;
    }

    private String fetchPrimaryImage(String websiteUrl) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.TEXT_HTML, MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT, "HermesRaceImageBot/1.0 (+https://hermes.local)");
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9");

        ResponseEntity<String> response = restTemplate.exchange(
                websiteUrl,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        String html = response.getBody();
        if (html == null || html.isBlank()) return null;

        URI baseUri = URI.create(websiteUrl);
        String metaImage = firstMetaImage(html, baseUri);
        if (metaImage != null) return metaImage;
        return firstInlineImage(html, baseUri);
    }

    private String firstMetaImage(String html, URI baseUri) {
        Matcher matcher = META_IMAGE_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            String image = sanitizeCandidate(raw, baseUri);
            if (image != null) return image;
        }
        return null;
    }

    private String firstInlineImage(String html, URI baseUri) {
        Matcher matcher = IMG_PATTERN.matcher(html);
        while (matcher.find()) {
            String image = sanitizeCandidate(matcher.group(1), baseUri);
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
            return SafeUrlValidator.validateHttpUrlOrNull(resolved, MAX_URL_LENGTH, "officialImageUrl");
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private record CachedImage(String imageUrl, Instant expiresAt) {
        private boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
