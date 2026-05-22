package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RaceElevationProfileService {
    private static final Duration CACHE_TTL = Duration.ofHours(12);
    private static final int MAX_URL_LENGTH = 500;
    private static final int PROFILE_SAMPLE_COUNT = 25;
    private static final Pattern MEDIA_URL_PATTERN = Pattern.compile("murl&quot;:&quot;([^&]+?)&quot;", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMG_PATTERN = Pattern.compile(
            "<img[^>]+(?:src|data-src|data-lazy-src)=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern HREF_PATTERN = Pattern.compile(
            "<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final List<String> IMAGE_HINTS = List.of(
            "elevation", "profile", "course", "altimetr", "altitude", "mapa", "graf", "高低", "海拔", "標高", "高度", "elevacion"
    );
    private static final List<String> REJECT_HINTS = List.of(
            "logo", "icon", "badge", "sponsor", "partner", "facebook", "instagram", "hero", "banner"
    );
    private final RestTemplate restTemplate;
    private final TtlCacheStore cacheStore;

    @Autowired
    public RaceElevationProfileService(RestTemplate restTemplate, TtlCacheStore cacheStore) {
        this.restTemplate = restTemplate;
        this.cacheStore = cacheStore;
    }

    public RaceElevationProfileService(RestTemplate restTemplate) {
        this(restTemplate, TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    public RaceElevationProfileResult resolveProfile(String raceName, String city, String country, String websiteUrl) {
        String cacheKey = String.join("||",
                normalize(raceName),
                normalize(city),
                normalize(country),
                normalize(websiteUrl)
        );
        CachedResult cached = cacheStore.get("race-elevation-profile", cacheKey, CachedResult.class).orElse(null);
        if (cached != null && !shouldRefresh(cached.result())) {
            return cached.result();
        }

        RaceElevationProfileResult resolved = doResolveProfile(raceName, city, country, websiteUrl);
        cacheStore.put("race-elevation-profile", cacheKey, new CachedResult(resolved), CACHE_TTL);
        return resolved;
    }

    private RaceElevationProfileResult doResolveProfile(String raceName, String city, String country, String websiteUrl) {
        String safeWebsite = SafeUrlValidator.validateHttpUrlOrNull(websiteUrl, MAX_URL_LENGTH, "officialWebsite");
        String websiteHost = safeWebsite == null ? "" : URI.create(safeWebsite).getHost();

        if (safeWebsite != null) {
            String officialImage = findOnOfficialPages(safeWebsite);
            if (officialImage != null) {
                RaceElevationProfileResult result = buildProfileResult(officialImage, "official-site", false);
                if (result != null) {
                    return result;
                }
            }
        }

        for (String query : buildEnglishQueries(raceName, city, websiteHost)) {
            String image = fetchBingImage(query);
            if (image != null) {
                RaceElevationProfileResult result = buildProfileResult(image, query, false);
                if (result != null) {
                    return result;
                }
            }
        }

        for (String query : buildLocalizedQueries(raceName, city, country, websiteHost)) {
            String image = fetchBingImage(query);
            if (image != null) {
                RaceElevationProfileResult result = buildProfileResult(image, query, true);
                if (result != null) {
                    return result;
                }
            }
        }

        return new RaceElevationProfileResult("", "", false, List.of());
    }

    private String findOnOfficialPages(String websiteUrl) {
        List<String> candidates = new ArrayList<>();
        candidates.add(websiteUrl);
        candidates.add(appendPath(websiteUrl, "/about/course"));
        candidates.add(appendPath(websiteUrl, "/about/course/"));
        candidates.add(appendPath(websiteUrl, "/course"));
        candidates.add(appendPath(websiteUrl, "/course-map"));
        candidates.add(appendPath(websiteUrl, "/map"));
        candidates.add(appendPath(websiteUrl, "/race-info"));
        candidates.add(appendPath(websiteUrl, "/about/course"));
        candidates.add(appendPath(websiteUrl, "/en/course"));
        candidates.add(appendPath(websiteUrl, "/en/course-map"));
        candidates.add(appendPath(websiteUrl, "/en/about/course"));
        candidates.add(appendPath(websiteUrl, "/en/about/course/"));

        for (String candidate : new LinkedHashSet<>(candidates)) {
            if (candidate == null) continue;
            String image = firstProfileImageOnPage(candidate);
            if (image != null) return image;
        }
        return null;
    }

    private String appendPath(String websiteUrl, String path) {
        try {
            URI base = URI.create(websiteUrl);
            return base.resolve(path).toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String firstProfileImageOnPage(String pageUrl) {
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    pageUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(buildHtmlHeaders()),
                    String.class
            );
            String html = response.getBody();
            if (html == null || html.isBlank()) return null;

            URI baseUri = URI.create(pageUrl);
            Matcher matcher = IMG_PATTERN.matcher(html);
            while (matcher.find()) {
                String raw = matcher.group(1);
                String candidate = sanitizeImageCandidate(raw, baseUri);
                if (candidate != null) return candidate;
            }

            Matcher hrefMatcher = HREF_PATTERN.matcher(html);
            while (hrefMatcher.find()) {
                String raw = hrefMatcher.group(1);
                String candidate = sanitizeLinkedProfileCandidate(raw, baseUri);
                if (candidate != null) return candidate;
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private String sanitizeImageCandidate(String raw, URI baseUri) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.trim();
        if (normalized.startsWith("data:")) return null;
        String lower = normalized.toLowerCase(Locale.ROOT);
        boolean hasHint = IMAGE_HINTS.stream().anyMatch(lower::contains);
        boolean rejected = REJECT_HINTS.stream().anyMatch(lower::contains);
        if (!hasHint || rejected) return null;
        try {
            String resolved = baseUri.resolve(normalized).toString();
            if (!isImageFileUrl(resolved)) return null;
            return SafeUrlValidator.validateHttpUrlOrNull(resolved, MAX_URL_LENGTH, "elevationProfileUrl");
        } catch (Exception ignored) {
            return null;
        }
    }

    private String sanitizeLinkedProfileCandidate(String raw, URI baseUri) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.trim();
        if (normalized.startsWith("data:") || normalized.startsWith("#")) return null;
        String lower = normalized.toLowerCase(Locale.ROOT);
        boolean hasHint = IMAGE_HINTS.stream().anyMatch(lower::contains);
        boolean isPdf = lower.contains(".pdf");
        boolean isImage = lower.contains(".jpg") || lower.contains(".jpeg") || lower.contains(".png") || lower.contains(".webp") || lower.contains(".gif") || lower.contains(".avif");
        boolean rejected = REJECT_HINTS.stream().anyMatch(lower::contains);
        if ((!hasHint && !isPdf) || rejected || (!isPdf && !isImage)) return null;
        try {
            String resolved = baseUri.resolve(normalized).toString();
            return SafeUrlValidator.validateHttpUrlOrNull(resolved, MAX_URL_LENGTH, "elevationProfileUrl");
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<String> buildEnglishQueries(String raceName, String city, String websiteHost) {
        List<String> queries = new ArrayList<>();
        String baseRace = normalizeSpacing(raceName);
        String baseCity = normalizeSpacing(city);
        queries.add(baseRace + " marathon elevation profile");
        queries.add(baseRace + " course elevation chart");
        queries.add(baseCity + " marathon elevation profile");
        if (!websiteHost.isBlank()) {
            queries.add("site:" + websiteHost + " " + baseRace + " elevation profile");
            queries.add("site:" + websiteHost + " " + baseRace + " course map elevation");
        }
        return queries.stream().filter(q -> q != null && !q.isBlank()).toList();
    }

    private List<String> buildLocalizedQueries(String raceName, String city, String country, String websiteHost) {
        LocalizedTerms terms = localizedTermsForCountry(country);
        if (terms == null) return List.of();

        List<String> queries = new ArrayList<>();
        String baseRace = normalizeSpacing(raceName);
        String baseCity = normalizeSpacing(city);
        queries.add(baseRace + " " + terms.profileQuery());
        queries.add(baseCity + " " + terms.profileQuery());
        if (!websiteHost.isBlank()) {
            queries.add("site:" + websiteHost + " " + baseRace + " " + terms.profileQuery());
        }
        return queries.stream().filter(q -> q != null && !q.isBlank()).toList();
    }

    private LocalizedTerms localizedTermsForCountry(String country) {
        if (country == null) return null;
        return switch (country.trim()) {
            case "China", "Hong Kong", "Taiwan" -> new LocalizedTerms("马拉松 海拔图");
            case "Japan" -> new LocalizedTerms("マラソン 高低図");
            case "South Korea" -> new LocalizedTerms("마라톤 고도 프로필");
            case "France" -> new LocalizedTerms("marathon profil altimétrique");
            case "Germany", "Austria", "Switzerland" -> new LocalizedTerms("Marathon Höhenprofil");
            case "Spain", "Mexico", "Argentina", "Chile" -> new LocalizedTerms("maratón perfil de elevación");
            case "Portugal", "Brazil" -> new LocalizedTerms("maratona perfil altimétrico");
            case "Italy" -> new LocalizedTerms("maratona profilo altimetrico");
            case "Netherlands", "Belgium" -> new LocalizedTerms("marathon hoogteprofiel");
            case "Poland", "Czech Republic" -> new LocalizedTerms("maraton profil wysokości");
            case "Greece" -> new LocalizedTerms("μαραθώνιος υψομετρικό προφίλ");
            case "Turkey" -> new LocalizedTerms("maraton yükseklik profili");
            case "Thailand" -> new LocalizedTerms("มาราธอน โปรไฟล์ความสูง");
            case "Vietnam" -> new LocalizedTerms("marathon biểu đồ độ cao");
            case "Indonesia" -> new LocalizedTerms("maraton profil elevasi");
            default -> null;
        };
    }

    private String fetchBingImage(String query) {
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    "https://www.bing.com/images/search?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&first=1",
                    HttpMethod.GET,
                    new HttpEntity<>(buildHtmlHeaders()),
                    String.class
            );
            String html = response.getBody();
            if (html == null || html.length() < 100) return null;
            Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
            while (matcher.find()) {
                String url = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
                if (isImageFileUrl(url)) {
                    return SafeUrlValidator.validateHttpUrlOrNull(url, MAX_URL_LENGTH, "elevationProfileUrl");
                }
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private HttpHeaders buildHtmlHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.TEXT_HTML, MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9");
        return headers;
    }

    private List<Integer> extractProfileSamples(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return List.of();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.ALL));
            headers.set(HttpHeaders.USER_AGENT,
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    imageUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );
            byte[] body = response.getBody();
            if (body == null || body.length == 0) return List.of();
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(body));
            if (image == null) return List.of();
            return interpretProfileSamples(image);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private RaceElevationProfileResult buildProfileResult(String imageUrl, String source, boolean localizedFallbackUsed) {
        List<Integer> samples = extractProfileSamples(imageUrl);
        if (samples.isEmpty()) {
            return null;
        }
        return new RaceElevationProfileResult(imageUrl, source, localizedFallbackUsed, samples);
    }

    private List<Integer> interpretProfileSamples(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        if (width < 120 || height < 60) return List.of();

        int left = Math.max(0, Math.round(width * 0.05f));
        int right = Math.min(width - 1, Math.round(width * 0.95f));
        int top = Math.max(0, Math.round(height * 0.08f));
        int bottom = Math.min(height - 1, Math.round(height * 0.86f));
        if (right - left < 50 || bottom - top < 30) return List.of();

        int background = averageColor(
                image.getRGB(left, top),
                image.getRGB(right, top),
                image.getRGB(left, bottom),
                image.getRGB(right, bottom)
        );

        int columnCount = right - left + 1;
        int[] edgeYs = new int[columnCount];
        int found = 0;

        for (int x = left; x <= right; x++) {
            int bestY = -1;
            for (int y = top; y <= bottom; y++) {
                int rgb = image.getRGB(x, y);
                if (!isForegroundPixel(rgb, background)) continue;
                int support = 0;
                int supportEnd = Math.min(bottom, y + Math.max(6, (bottom - top) / 10));
                for (int probe = y; probe <= supportEnd; probe++) {
                    if (isForegroundPixel(image.getRGB(x, probe), background)) {
                        support += 1;
                    }
                }
                if (support >= 4) {
                    bestY = y;
                    break;
                }
            }
            edgeYs[x - left] = bestY;
            if (bestY >= 0) found += 1;
        }

        if (found < Math.max(14, Math.round(columnCount * 0.18f))) return List.of();

        fillMissingColumns(edgeYs, bottom);
        smoothColumns(edgeYs);

        int minY = bottom;
        int maxY = top;
        for (int value : edgeYs) {
            minY = Math.min(minY, value);
            maxY = Math.max(maxY, value);
        }
        int range = Math.max(8, maxY - minY);

        List<Integer> samples = new ArrayList<>();
        for (int i = 0; i < PROFILE_SAMPLE_COUNT; i++) {
            double ratio = PROFILE_SAMPLE_COUNT == 1 ? 0 : (double) i / (PROFILE_SAMPLE_COUNT - 1);
            int index = (int) Math.round(ratio * (edgeYs.length - 1));
            int y = edgeYs[Math.max(0, Math.min(edgeYs.length - 1, index))];
            double normalized = 1.0 - ((double) (y - minY) / range);
            int sample = (int) Math.round(Math.max(0, Math.min(100, normalized * 100)));
            samples.add(sample);
        }
        return samples;
    }

    private void fillMissingColumns(int[] edgeYs, int fallbackY) {
        int lastKnown = -1;
        for (int i = 0; i < edgeYs.length; i++) {
            if (edgeYs[i] >= 0) {
                lastKnown = edgeYs[i];
            } else if (lastKnown >= 0) {
                edgeYs[i] = lastKnown;
            }
        }
        lastKnown = -1;
        for (int i = edgeYs.length - 1; i >= 0; i--) {
            if (edgeYs[i] >= 0) {
                lastKnown = edgeYs[i];
            } else if (lastKnown >= 0) {
                edgeYs[i] = lastKnown;
            } else {
                edgeYs[i] = fallbackY;
            }
        }
    }

    private void smoothColumns(int[] edgeYs) {
        int[] copy = edgeYs.clone();
        for (int i = 0; i < edgeYs.length; i++) {
            int start = Math.max(0, i - 2);
            int end = Math.min(edgeYs.length - 1, i + 2);
            int sum = 0;
            int count = 0;
            for (int j = start; j <= end; j++) {
                sum += copy[j];
                count += 1;
            }
            edgeYs[i] = Math.round((float) sum / Math.max(1, count));
        }
    }

    private boolean isForegroundPixel(int rgb, int backgroundRgb) {
        int r = (rgb >> 16) & 0xff;
        int g = (rgb >> 8) & 0xff;
        int b = rgb & 0xff;
        int br = (backgroundRgb >> 16) & 0xff;
        int bg = (backgroundRgb >> 8) & 0xff;
        int bb = backgroundRgb & 0xff;

        int colorDistance = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
        int max = Math.max(r, Math.max(g, b));
        int min = Math.min(r, Math.min(g, b));
        int saturation = max - min;
        int brightness = (r + g + b) / 3;
        return colorDistance >= 72 || (saturation >= 36 && Math.abs(brightness - ((br + bg + bb) / 3)) >= 18);
    }

    private int averageColor(int... values) {
        int r = 0;
        int g = 0;
        int b = 0;
        for (int value : values) {
            r += (value >> 16) & 0xff;
            g += (value >> 8) & 0xff;
            b += value & 0xff;
        }
        int count = Math.max(1, values.length);
        return ((r / count) << 16) | ((g / count) << 8) | (b / count);
    }

    private boolean isImageFileUrl(String url) {
        if (url == null || !url.startsWith("http")) return false;
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains(".html") || lower.contains(".htm")) return false;
        return lower.contains(".jpg") || lower.contains(".jpeg") ||
                lower.contains(".png") || lower.contains(".webp") ||
                lower.contains(".gif") || lower.contains(".avif");
    }

    private boolean shouldRefresh(RaceElevationProfileResult result) {
        if (result == null) return true;
        List<Integer> samples = result.profileSamples();
        return samples == null || samples.isEmpty();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeSpacing(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    public record RaceElevationProfileResult(String imageUrl, String source, boolean localizedFallbackUsed, List<Integer> profileSamples) {}

    private record LocalizedTerms(String profileQuery) {}

    private record CachedResult(RaceElevationProfileResult result) {
    }
}
