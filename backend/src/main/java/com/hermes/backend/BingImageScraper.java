package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class BingImageScraper {
    private static final Logger logger = LoggerFactory.getLogger(BingImageScraper.class);

    private static final Pattern MEDIA_URL_PATTERN =
            Pattern.compile("mediaurl=(https?%3a%2f%2f[^&\"]+)", Pattern.CASE_INSENSITIVE);

    private static final Map<String, String> BRAND_DOMAINS = Map.ofEntries(
            Map.entry("nike", "nike.com"),
            Map.entry("adidas", "adidas.com"),
            Map.entry("asics", "asics.com"),
            Map.entry("new balance", "newbalance.com"),
            Map.entry("hoka", "hoka.com"),
            Map.entry("brooks", "brooksrunning.com"),
            Map.entry("saucony", "saucony.com"),
            Map.entry("on", "on-running.com"),
            Map.entry("mizuno", "mizuno.com"),
            Map.entry("altra", "altrarunning.com"),
            Map.entry("puma", "puma.com"),
            Map.entry("reebok", "reebok.com"),
            Map.entry("under armour", "underarmour.com"),
            Map.entry("skechers", "skechers.com"),
            Map.entry("361°", "361sport.com"),
            Map.entry("361 degrees", "361sport.com"),
            Map.entry("li-ning", "lining.com"),
            Map.entry("li ning", "lining.com"),
            Map.entry("anta", "anta.com"),
            Map.entry("xtep", "xtep.com.hk"),
            Map.entry("peak", "peaksport.com"),
            Map.entry("特步", "xtep.com.hk"),
            Map.entry("安踏", "anta.com"),
            Map.entry("李宁", "lining.com"),
            Map.entry("匹克", "peaksport.com"),
            Map.entry("361度", "361sport.com")
    );

    private final RestTemplate restTemplate;

    public BingImageScraper(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<String> searchShoeImageCandidates(String brand, String model) {
        String brandLower = brand.toLowerCase().trim();
        String cnQuery = brand + " " + model + " 跑鞋";
        LinkedHashSet<String> results = new LinkedHashSet<>();

        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 京东 白底图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 淘宝 主图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 拼多多 主图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 得物 白底图"), 4));

        String domain = BRAND_DOMAINS.get(brandLower);
        if (domain != null) {
            results.addAll(fetchMultipleImages(bingImageUrl(brand + " " + model + " site:" + domain), 4));
        }

        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 跑鞋 透底图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " running shoe white background"), 4));

        return new ArrayList<>(results);
    }

    public String scrapeShoeImage(String brand, String model) {
        String brandLower = brand.toLowerCase().trim();
        String cnQuery = brand + " " + model + " 跑鞋";

        String[] specificTargets = {
            " 京东 白底图",
            " 淘宝 主图",
            " 得物 白底图",
            " 拼多多 主图"
        };

        for (String target : specificTargets) {
            String result = fetchAndParse(bingImageUrl(cnQuery + target));
            if (result != null) return result;
        }

        String domain = BRAND_DOMAINS.get(brandLower);
        if (domain != null) {
            String result = fetchAndParse(bingImageUrl(brand + " " + model + " site:" + domain));
            if (result != null) return result;
        }

        String result = fetchAndParse(bingImageUrl(cnQuery + " site:jd.com"));
        if (result != null) return result;
        result = fetchAndParse(bingImageUrl(cnQuery + " site:taobao.com"));
        if (result != null) return result;

        result = fetchAndParse(bingImageUrl(cnQuery + " 跑鞋 白底图"));
        if (result != null) return result;

        return fetchAndParse(bingImageUrl(brand + " " + model + " running shoe white background"));
    }

    public List<String> scrapeMultipleImages(String query, int maxResults) {
        return fetchMultipleImages(bingImageUrl(query), maxResults);
    }

    public List<String> sanitizeImageUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String u : urls) {
            if (isImageFileUrl(u)) out.add(u);
        }
        return new ArrayList<>(out);
    }

    public List<String> fetchMultipleImages(String searchUrl, int maxResults) {
        List<String> urls = new ArrayList<>();
        try {
            String html = fetchBingHtml(searchUrl);
            if (html == null || html.length() < 100) return urls;

            Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
            while (matcher.find() && urls.size() < maxResults) {
                String url = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
                if (isImageFileUrl(url) && !urls.contains(url)) {
                    urls.add(url);
                }
            }
        } catch (Exception e) {
            logger.warn("Multi-image fetch failed: {}", e.getMessage(), e);
        }
        return urls;
    }

    public String fetchAndParse(String searchUrl) {
        try {
            String html = fetchBingHtml(searchUrl);
            if (html == null || html.length() < 100) {
                logger.warn("Bing returned empty/short response for: {}", searchUrl);
                return null;
            }

            Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
            while (matcher.find()) {
                String url = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
                if (isImageFileUrl(url)) return url;
            }
        } catch (Exception e) {
            logger.warn("Image fetch failed for {}: {}", searchUrl, e.getMessage(), e);
        }
        return null;
    }

    private String fetchBingHtml(String searchUrl) {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        headers.set("Accept-Language", "en-US,en;q=0.9");

        org.springframework.http.ResponseEntity<String> response = restTemplate.exchange(
                searchUrl,
                org.springframework.http.HttpMethod.GET,
                new org.springframework.http.HttpEntity<>(headers),
                String.class);
        return response.getBody();
    }

    public String bingImageUrl(String query) {
        return "https://www.bing.com/images/search?q="
                + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&first=1";
    }

    public boolean isImageFileUrl(String url) {
        if (url == null || !url.startsWith("http")) return false;
        String lower = url.toLowerCase();
        if (lower.contains(".html") || lower.contains(".htm")) return false;
        return lower.contains(".jpg") || lower.contains(".jpeg") ||
               lower.contains(".png") || lower.contains(".webp") ||
               lower.contains(".gif") || lower.contains(".avif");
    }
}
