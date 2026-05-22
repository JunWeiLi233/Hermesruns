package com.hermes.backend;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RaceCourseMapSearchService {
    private static final int MAX_URL_LENGTH = 500;
    private static final Pattern MEDIA_URL_PATTERN = Pattern.compile("murl&quot;:&quot;([^&]+?)&quot;", Pattern.CASE_INSENSITIVE);
    private static final Pattern META_IMAGE_PATTERN = Pattern.compile(
            "<meta[^>]+(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"'][^>]+content=[\"']([^\"'#]+(?:\\?[^\"']*)?)[\"'][^>]*>|"
                    + "<meta[^>]+content=[\"']([^\"'#]+(?:\\?[^\"']*)?)[\"'][^>]+(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern IMG_PATTERN = Pattern.compile(
            "<img[^>]+(?:src|data-src|data-lazy-src)=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern HREF_PATTERN = Pattern.compile(
            "<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final List<String> COURSE_HINTS = List.of(
            "course", "route", "map", "track", "parcours", "percorso", "strecke", "cours", "plan", "karte"
    );
    private static final List<String> PRIORITY_COURSE_HINTS = List.of(
            "map", "course", "route", "karte", "parcours"
    );
    private static final List<String> REJECT_HINTS = List.of(
            "logo", "icon", "badge", "hero", "banner", "sponsor", "partner", "medal", "podium"
    );

    private final RestTemplate restTemplate;

    public RaceCourseMapSearchService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public LinkedHashMap<String, RaceCourseMapService.CourseMapCandidate> collectCandidates(String raceName, String city, String country, String websiteUrl, Double distanceKm) {
        LinkedHashMap<String, RaceCourseMapService.CourseMapCandidate> candidates = new LinkedHashMap<>();
        String websiteHost = "";
        if (websiteUrl != null) {
            try {
                websiteHost = URI.create(websiteUrl).getHost();
            } catch (Exception ignored) {
                websiteHost = "";
            }
        }
        for (String query : buildSearchQueries(raceName, city, country, websiteHost, distanceKm).stream().limit(4).toList()) {
            collectSearchCandidates(candidates, query);
        }
        return candidates;
    }

    void collectOfficialPageCandidates(Map<String, RaceCourseMapService.CourseMapCandidate> candidates, String websiteUrl) {
        List<String> pages = new ArrayList<>();
        pages.add(websiteUrl);
        List<String> relativePages = List.of(
                "course", "course/", "course-map", "course-map/", "route", "route/", "route-map", "route-map/",
                "map", "map/", "the-course", "race-info", "race-info/course", "course-details", "race-details",
                "en/course", "en/course/", "en/race/course", "en/map", "about/course", "about/course/",
                "about/course-map", "about/course-map/", "about/route", "about/route-map", "?page=course",
                "?tab=map", "?section=route", "course.pdf", "race-map.pdf", "course-map.pdf"
        );
        for (String relativePage : relativePages) {
            pages.add(appendRelativePath(websiteUrl, relativePage));
        }
        pages.add(appendPath(websiteUrl, "/course"));
        pages.add(appendPath(websiteUrl, "/course-map"));
        pages.add(appendPath(websiteUrl, "/route"));
        pages.add(appendPath(websiteUrl, "/route-map"));
        pages.add(appendPath(websiteUrl, "/map"));
        pages.add(appendPath(websiteUrl, "/the-course"));
        pages.add(appendPath(websiteUrl, "/race-info"));
        pages.add(appendPath(websiteUrl, "/race-info/course"));
        pages.add(appendPath(websiteUrl, "/course-details"));
        pages.add(appendPath(websiteUrl, "/race-details"));
        pages.add(appendPath(websiteUrl, "/en/course"));
        pages.add(appendPath(websiteUrl, "/en/race/course"));
        pages.add(appendPath(websiteUrl, "/en/course-map"));
        pages.add(appendPath(websiteUrl, "/en/map"));
        pages.add(appendPath(websiteUrl, "/en/route"));
        pages.add(buildSubdomainUrl(websiteUrl, "course"));
        pages.add(buildSubdomainUrl(websiteUrl, "map"));
        pages.add(appendPath(websiteUrl, "/course.pdf"));
        pages.add(appendPath(websiteUrl, "/race-map.pdf"));
        pages.add(appendPath(websiteUrl, "/course-map.pdf"));

        for (String page : new LinkedHashSet<>(pages)) {
            if (page == null) continue;
            String html = fetchHtml(page);
            if (html == null || html.isBlank()) continue;
            URI baseUri = URI.create(page);
            int pageBoost = scoreText(page) + scorePriorityHints(page);
            collectMetaCandidates(candidates, html, baseUri, page, pageBoost + 2);
            collectImageCandidates(candidates, html, baseUri, page, pageBoost);
            collectLinkedImageCandidates(candidates, html, baseUri, page, pageBoost - 1);
        }
    }

    private void collectMetaCandidates(Map<String, RaceCourseMapService.CourseMapCandidate> candidates, String html, URI baseUri, String pageUrl, int baseScore) {
        Matcher matcher = META_IMAGE_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            addCandidate(candidates, raw, baseUri, "official-page:" + pageUrl, baseScore + scoreText(raw));
        }
    }

    private void collectImageCandidates(Map<String, RaceCourseMapService.CourseMapCandidate> candidates, String html, URI baseUri, String pageUrl, int baseScore) {
        Matcher matcher = IMG_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1);
            int score = baseScore + scoreText(raw) + scoreText(matcher.group(0));
            addCandidate(candidates, raw, baseUri, "official-page:" + pageUrl, score);
        }
    }

    private void collectLinkedImageCandidates(Map<String, RaceCourseMapService.CourseMapCandidate> candidates, String html, URI baseUri, String pageUrl, int baseScore) {
        Matcher matcher = HREF_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1);
            int score = baseScore + scoreText(raw);
            addCandidate(candidates, raw, baseUri, "official-link:" + pageUrl, score);
        }
    }

    private void collectSearchCandidates(Map<String, RaceCourseMapService.CourseMapCandidate> candidates, String query) {
        String html = fetchHtml("https://www.bing.com/images/search?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&first=1");
        if (html == null || html.isBlank()) return;
        Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
        int added = 0;
        while (matcher.find() && added < 4) {
            String decoded = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
            if (addCandidate(candidates, decoded, null, query, 4 + scoreText(query) + scorePriorityHints(query) + scoreText(decoded) + scorePriorityHints(decoded))) {
                added += 1;
            }
        }
    }

    private boolean addCandidate(Map<String, RaceCourseMapService.CourseMapCandidate> candidates, String raw, URI baseUri, String source, int score) {
        if (raw == null || raw.isBlank()) return false;
        try {
            String resolved = baseUri == null ? raw.trim() : baseUri.resolve(raw.trim()).toString();
            String safe = SafeUrlValidator.validateHttpsUrlOrNull(resolved, MAX_URL_LENGTH, "courseMapImageUrl");
            if (safe == null || (!isImageFileUrl(safe) && !isPdfFileUrl(safe))) return false;
            if (baseUri == null && !hasPriorityCourseHint(safe)) return false;
            if (baseUri == null && isFullMarathonSearch(source) && isHalfMarathonSignal(safe)) return false;
            int totalScore = score + scoreText(safe) + scorePriorityHints(safe);
            if (totalScore <= 0) return false;
            RaceCourseMapService.CourseMapCandidate existing = candidates.get(safe);
            if (existing == null || totalScore > existing.score()) {
                candidates.put(safe, new RaceCourseMapService.CourseMapCandidate(safe, source, totalScore));
            }
            return true;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private boolean hasPriorityCourseHint(String value) {
        if (value == null || value.isBlank()) return false;
        String lower = value.toLowerCase(Locale.ROOT);
        for (String hint : PRIORITY_COURSE_HINTS) {
            if (lower.contains(hint)) return true;
        }
        return false;
    }

    private boolean isFullMarathonSearch(String source) {
        if (source == null) return false;
        String lower = source.toLowerCase(Locale.ROOT);
        return lower.contains("42km") || lower.contains("42.195") || lower.contains("marathon");
    }

    private boolean isHalfMarathonSignal(String value) {
        if (value == null) return false;
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.contains("half-marathon")
                || lower.contains("half_marathon")
                || lower.contains("halfmarathon")
                || lower.contains("half-route")
                || lower.contains("half_route")
                || lower.contains("/half/");
    }

    private String fetchHtml(String url) {
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(buildHtmlHeaders()), String.class);
            return response.getBody();
        } catch (Exception ignored) {
            return null;
        }
    }

    private HttpHeaders buildHtmlHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.TEXT_HTML, MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9");
        return headers;
    }

    private List<String> buildSearchQueries(String raceName, String city, String country, String websiteHost, Double distanceKm) {
        List<String> queries = new ArrayList<>();
        String baseRace = normalizeSpacing(raceName);
        String baseCity = normalizeSpacing(city);
        String distanceToken = formatDistanceSearchToken(distanceKm);
        if (websiteHost != null && !websiteHost.isBlank()) {
            queries.add(String.format("\"%s\" %s course map route filetype:png OR filetype:jpg OR filetype:pdf site:%s", baseRace, distanceToken, websiteHost));
        }
        queries.add(String.format("\"%s\" %s course map route filetype:png OR filetype:jpg OR filetype:pdf", baseRace, distanceToken));
        queries.add(baseRace + " course map");
        queries.add(baseRace + " route map");
        if (!baseCity.isBlank()) queries.add(baseCity + " marathon course map");
        String localized = localizedCourseQueryForCountry(country);
        if (localized != null) queries.add(baseRace + " " + localized);
        return queries.stream().filter(query -> query != null && !query.isBlank()).toList();
    }

    private String localizedCourseQueryForCountry(String country) {
        if (country == null) return null;
        return switch (country.trim()) {
            case "Japan" -> "course map";
            case "France" -> "carte du parcours";
            case "Germany", "Austria", "Switzerland" -> "streckenkarte";
            case "Spain", "Mexico", "Argentina", "Chile" -> "mapa del recorrido";
            case "Portugal", "Brazil" -> "mapa do percurso";
            case "Italy" -> "mappa del percorso";
            default -> null;
        };
    }

    private String normalizeSpacing(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String formatDistanceSearchToken(Double distanceKm) {
        if (distanceKm == null || distanceKm <= 0) return "";
        return ((int) Math.round(distanceKm)) + "km";
    }

    private boolean isImageFileUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains(".html") || lower.contains(".htm")) return false;
        return lower.contains(".png") || lower.contains(".jpg") || lower.contains(".jpeg")
                || lower.contains(".webp") || lower.contains(".gif") || lower.contains(".avif");
    }

    private boolean isPdfFileUrl(String url) {
        return url != null && url.toLowerCase(Locale.ROOT).contains(".pdf");
    }

    private int scoreText(String value) {
        if (value == null || value.isBlank()) return 0;
        String lower = value.toLowerCase(Locale.ROOT);
        int score = 0;
        for (String hint : COURSE_HINTS) {
            if (lower.contains(hint)) score += 2;
        }
        for (String reject : REJECT_HINTS) {
            if (lower.contains(reject)) score -= 4;
        }
        return score;
    }

    private int scorePriorityHints(String value) {
        if (value == null || value.isBlank()) return 0;
        String lower = value.toLowerCase(Locale.ROOT);
        int score = 0;
        for (String hint : PRIORITY_COURSE_HINTS) {
            if (lower.contains(hint)) score += 4;
        }
        return score;
    }

    private String appendPath(String websiteUrl, String path) {
        try {
            return URI.create(websiteUrl).resolve(path).toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String appendRelativePath(String websiteUrl, String path) {
        try {
            String base = websiteUrl == null ? null : websiteUrl.trim();
            if (base == null || base.isBlank()) return null;
            if (!base.endsWith("/")) base = base + "/";
            return URI.create(base).resolve(path).toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String buildSubdomainUrl(String websiteUrl, String subdomain) {
        try {
            URI uri = URI.create(websiteUrl);
            String host = uri.getHost();
            if (host == null || host.isBlank()) return null;
            String nextHost = subdomain + "." + host;
            return new URI(uri.getScheme(), uri.getUserInfo(), nextHost, uri.getPort(), "/", null, null).toString();
        } catch (Exception ignored) {
            return null;
        }
    }
}
