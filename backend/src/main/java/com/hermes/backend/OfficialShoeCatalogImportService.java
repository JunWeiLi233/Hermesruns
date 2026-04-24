package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OfficialShoeCatalogImportService {
    private static final Pattern[] TITLE_PATTERNS = new Pattern[] {
            Pattern.compile("<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<meta[^>]+name=[\"']twitter:title[\"'][^>]+content=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\"name\"\\s*:\\s*\"([^\"]+)\"", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<title>([^<]+)</title>", Pattern.CASE_INSENSITIVE)
    };
    private static final List<String> COMMON_BRANDS = List.of(
            "Nike", "Adidas", "ASICS", "New Balance", "Saucony", "HOKA", "Brooks",
            "PUMA", "On", "Mizuno", "Li-Ning", "361", "Xtep", "Anta"
    );
    private static final Pattern[] GENERIC_SUFFIXES = new Pattern[] {
            Pattern.compile("\\broad running shoes\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\brunning shoes\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bmen'?s shoes\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bwomen'?s shoes\\b", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\bshoe\\b", Pattern.CASE_INSENSITIVE)
    };

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public ImportResult importPage(String url, String requestedBrand, String requestedModelZh, String requestedModelEn) {
        URI uri = validateUrl(url);
        String html = fetchHtml(uri);
        String officialName = extractOfficialName(html);
        if (officialName.isBlank()) {
            throw new IllegalArgumentException("Could not read the shoe name from that official page.");
        }

        String brand = requestedBrand == null || requestedBrand.isBlank()
                ? inferBrand(officialName)
                : requestedBrand.trim();
        String model = extractModelName(brand, officialName);
        if (brand.isBlank() || model.isBlank()) {
            throw new IllegalArgumentException("Could not infer a clean brand/model from that page. Add the brand manually and retry.");
        }

        String modelZh = requestedModelZh == null ? "" : requestedModelZh.trim();
        String modelEn = requestedModelEn == null || requestedModelEn.isBlank() ? model : requestedModelEn.trim();
        return new ImportResult(officialName, brand, model, modelZh, modelEn);
    }

    private URI validateUrl(String rawUrl) {
        try {
            URI uri = new URI(rawUrl.trim());
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                throw new IllegalArgumentException("Only http/https product pages are supported.");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("A valid official product page URL is required.");
            }
            return uri;
        } catch (URISyntaxException ex) {
            throw new IllegalArgumentException("A valid official product page URL is required.");
        }
    }

    private String fetchHtml(URI uri) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(15))
                .header("User-Agent", "HermesCatalogImporter/1.0")
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalArgumentException("Official page returned " + response.statusCode() + ".");
            }
            return response.body();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("Fetching the official product page was interrupted.");
        } catch (IOException ex) {
            throw new IllegalArgumentException("Failed to fetch the official product page.");
        }
    }

    private String extractOfficialName(String html) {
        for (Pattern pattern : TITLE_PATTERNS) {
            Matcher matcher = pattern.matcher(html);
            if (matcher.find()) {
                return decodeHtml(matcher.group(1));
            }
        }
        return "";
    }

    private String inferBrand(String officialName) {
        String lower = officialName.toLowerCase(Locale.ROOT);
        return COMMON_BRANDS.stream()
                .filter(brand -> lower.startsWith(brand.toLowerCase(Locale.ROOT)))
                .findFirst()
                .orElse("");
    }

    private String extractModelName(String brand, String officialName) {
        String value = officialName;
        if (brand != null && !brand.isBlank()) {
            value = value.replaceFirst("(?i)^" + Pattern.quote(brand) + "\\s+", "");
        }
        for (Pattern suffix : GENERIC_SUFFIXES) {
            value = suffix.matcher(value).replaceAll("");
        }
        value = value.replaceFirst("\\s+[|.-]\\s+.*$", "");
        return normalizeWhitespace(value);
    }

    private String decodeHtml(String value) {
        return normalizeWhitespace(value
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">"));
    }

    private String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    public record ImportResult(
            String officialName,
            String brand,
            String model,
            String modelZh,
            String modelEn
    ) {}
}
