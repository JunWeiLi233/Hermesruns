package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/shoes")
public class ShoeImageController {

    private final AuthService authService;
    private final AiUsageService aiUsageService;
    private final RestTemplate restTemplate;

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.0-flash}")
    private String aiModel;

    @Value("${app.ai.provider:gemini}")
    private String aiProvider;

    private static final String SHOE_PROMPT =
            "Extract all running shoe names and their accumulated mileage from this screenshot. " +
            "Return ONLY a JSON array, no other text. Each element should have: " +
            "\"brand\" (string), \"model\" (string), \"distanceKm\" (number in kilometers). " +
            "If the distance is in miles, convert to km (multiply by 1.60934). " +
            "Example: [{\"brand\":\"Nike\",\"model\":\"Pegasus 41\",\"distanceKm\":342.5}]";

    private final ShoeRepository shoeRepository;

    // Bing uses mediaurl=URL_ENCODED in href attributes
    private static final Pattern MEDIA_URL_PATTERN =
            Pattern.compile("mediaurl=(https?%3a%2f%2f[^&\"]+)", Pattern.CASE_INSENSITIVE);

    // Brand → official website domain mapping
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

    public ShoeImageController(AuthService authService, ShoeRepository shoeRepository, AiUsageService aiUsageService, RestTemplate restTemplate) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.aiUsageService = aiUsageService;
        this.restTemplate = restTemplate;
    }

    // ── Admin endpoints (all shoes, regardless of owner) ──

    /** Admin: list all shoes across all users with runner email. */
    @GetMapping("/admin/all")
    public ResponseEntity<?> adminListAllShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        List<Shoe> shoes = shoeRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Shoe s : shoes) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("brand", s.getBrand());
            m.put("model", s.getModel());
            m.put("nickname", s.getNickname());
            m.put("photoUrl", s.getPhotoUrl());
            m.put("retired", s.isRetired());
            m.put("runnerEmail", s.getRunner() != null ? s.getRunner().getEmail() : null);
            result.add(m);
        }
        return ResponseEntity.ok(result);
    }

    /** Admin: search images for any shoe by ID. */
    @PostMapping("/admin/{id}/search-images")
    public ResponseEntity<?> adminSearchImages(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, String> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
        String model = shoe.getModel() != null ? shoe.getModel() : "";
        String customQuery = body != null ? body.getOrDefault("query", "") : "";

        try {
            List<String> images;
            if (!customQuery.isBlank()) {
                images = scrapeMultipleImages(customQuery, 12);
            } else {
                images = searchShoeImageCandidates(brand, model);
            }
            return ResponseEntity.ok(Map.of("images", images));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("images", List.of()));
        }
    }

    /**
     * Admin: set photo URL for a shoe by ID — applies to ALL shoes
     * with the same brand+model across all users.
     */
    @PutMapping("/admin/{id}/photo")
    public ResponseEntity<?> adminSetPhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String photoUrl = body.getOrDefault("photoUrl", "");
        String finalUrl = photoUrl.isBlank() ? null : photoUrl;

        // Apply to ALL shoes with same brand+model
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            for (Shoe s : matching) {
                s.setPhotoUrl(finalUrl);
                shoeRepository.save(s);
                count++;
            }
        } else {
            shoe.setPhotoUrl(finalUrl);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of(
                "photoUrl", finalUrl != null ? finalUrl : "",
                "updated", count
        ));
    }

    // ── User endpoints ──

    /**
     * Find shoe product image via Bing Image Search scraping — zero AI tokens.
     * Algorithm: construct search query → fetch Bing HTML → extract murl (media URL)
     * from embedded JSON → filter for image file extensions → save first match.
     */
    @PostMapping("/{id}/find-image")
    public ResponseEntity<?> findShoeImage(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
        String model = shoe.getModel() != null ? shoe.getModel() : "";
        if (brand.isBlank() && model.isBlank()) {
            return ResponseEntity.ok(Map.of("photoUrl", ""));
        }

        try {
            String imageUrl = scrapeShoeImage(brand, model);
            if (imageUrl != null) {
                shoe.setPhotoUrl(imageUrl);
                shoeRepository.save(shoe);
                return ResponseEntity.ok(Map.of("photoUrl", imageUrl));
            }
            return ResponseEntity.ok(Map.of("photoUrl", ""));
        } catch (Exception e) {
            System.err.println("Image search failed: " + e.getMessage());
            return ResponseEntity.ok(Map.of("photoUrl", ""));
        }
    }

    /**
     * Search for shoe images and return multiple candidates for admin to choose from.
     * Optionally accepts a custom query to refine the search.
     */
    @PostMapping("/{id}/search-images")
    public ResponseEntity<?> searchShoeImages(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) Map<String, String> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
        String model = shoe.getModel() != null ? shoe.getModel() : "";
        String customQuery = body != null ? body.getOrDefault("query", "") : "";

        try {
            List<String> images;
            if (!customQuery.isBlank()) {
                images = scrapeMultipleImages(customQuery, 12);
            } else {
                images = searchShoeImageCandidates(brand, model);
            }
            return ResponseEntity.ok(Map.of("images", images));
        } catch (Exception e) {
            System.err.println("Image search failed: " + e.getMessage());
            return ResponseEntity.ok(Map.of("images", List.of()));
        }
    }

    /**
     * Set or clear a shoe's photo URL directly.
     */
    @PutMapping("/{id}/photo")
    public ResponseEntity<?> setShoePhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String photoUrl = body.getOrDefault("photoUrl", "");
        shoe.setPhotoUrl(photoUrl.isBlank() ? null : photoUrl);
        shoeRepository.save(shoe);
        return ResponseEntity.ok(Map.of("photoUrl", shoe.getPhotoUrl() != null ? shoe.getPhotoUrl() : ""));
    }

    /**
     * Multi-strategy shoe image search — returns multiple candidates.
     * Searches across JD, Tmall, brand site, and generic queries.
     */
    private List<String> searchShoeImageCandidates(String brand, String model) {
        String brandLower = brand.toLowerCase().trim();
        String cnQuery = brand + " " + model + " 跑鞋";
        LinkedHashSet<String> results = new LinkedHashSet<>();

        // Strategy 1: JD.com
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " site:jd.com"), 4));
        // Strategy 2: Tmall
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " site:tmall.com"), 4));
        // Strategy 3: Bilibili (video thumbnails — great product shots from reviews)
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 测评 site:bilibili.com"), 4));
        // Strategy 4: Brand official website
        String domain = BRAND_DOMAINS.get(brandLower);
        if (domain != null) {
            results.addAll(fetchMultipleImages(bingImageUrl(brand + " " + model + " site:" + domain), 4));
        }
        // Strategy 5: Generic search
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(brand + " " + model + " running shoe"), 4));

        return new ArrayList<>(results);
    }

    /**
     * Multi-strategy shoe image search algorithm (auto-find — saves first match).
     */
    private String scrapeShoeImage(String brand, String model) {
        String brandLower = brand.toLowerCase().trim();
        String cnQuery = brand + " " + model + " 跑鞋";

        // Strategy 1: JD.com — clean product photos
        String result = fetchAndParse(bingImageUrl(cnQuery + " site:jd.com"));
        if (result != null) return result;

        // Strategy 2: Tmall
        result = fetchAndParse(bingImageUrl(cnQuery + " site:tmall.com"));
        if (result != null) return result;

        // Strategy 3: Brand official website
        String domain = BRAND_DOMAINS.get(brandLower);
        if (domain != null) {
            result = fetchAndParse(bingImageUrl(brand + " " + model + " site:" + domain));
            if (result != null) return result;
        }

        // Strategy 4: Generic search (Chinese + English)
        result = fetchAndParse(bingImageUrl(cnQuery));
        if (result != null) return result;

        result = fetchAndParse(bingImageUrl(brand + " " + model + " running shoe"));
        return result;
    }

    /** Fetch up to maxResults image URLs from a single Bing search page. */
    private List<String> fetchMultipleImages(String searchUrl, int maxResults) {
        List<String> urls = new ArrayList<>();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            headers.set("Accept-Language", "en-US,en;q=0.9");

            RestTemplate restTemplate = this.restTemplate;
            ResponseEntity<String> response = restTemplate.exchange(
                    searchUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            String html = response.getBody();
            if (html == null || html.length() < 100) return urls;

            Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
            while (matcher.find() && urls.size() < maxResults) {
                String url = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
                if (isImageFileUrl(url) && !urls.contains(url)) {
                    urls.add(url);
                }
            }
        } catch (Exception e) {
            System.err.println("Multi-image fetch failed: " + e.getMessage());
        }
        return urls;
    }

    /** Search with a custom query string, returning up to maxResults images. */
    private List<String> scrapeMultipleImages(String query, int maxResults) {
        return fetchMultipleImages(bingImageUrl(query), maxResults);
    }

    private String bingImageUrl(String query) {
        return "https://www.bing.com/images/search?q="
                + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&first=1";
    }

    private String fetchAndParse(String searchUrl) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            headers.set("Accept-Language", "en-US,en;q=0.9");

            RestTemplate restTemplate = this.restTemplate;
            ResponseEntity<String> response = restTemplate.exchange(
                    searchUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            String html = response.getBody();
            if (html == null || html.length() < 100) {
                System.err.println("Bing returned empty/short response for: " + searchUrl);
                return null;
            }

            // Extract mediaurl= values (URL-encoded) from Bing HTML
            Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
            while (matcher.find()) {
                String url = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
                if (isImageFileUrl(url)) return url;
            }
        } catch (Exception e) {
            System.err.println("Image fetch failed for " + searchUrl + ": " + e.getMessage());
        }
        return null;
    }

    private boolean isImageFileUrl(String url) {
        if (url == null || !url.startsWith("http")) return false;
        String lower = url.toLowerCase();
        return lower.contains(".jpg") || lower.contains(".jpeg") ||
               lower.contains(".png") || lower.contains(".webp") ||
               lower.contains("image") || lower.contains("/img/");
    }

    @GetMapping("/scan-available")
    public ResponseEntity<?> isScanAvailable(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        boolean available = aiApiKey != null && !aiApiKey.isBlank();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", available);
        if (available) {
            result.putAll(aiUsageService.getUsageStatus(user.get()));
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/ai-usage")
    public ResponseEntity<?> getAiUsage(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        return ResponseEntity.ok(aiUsageService.getUsageStatus(user.get()));
    }

    @PostMapping("/scan-image")
    public ResponseEntity<?> scanImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam("image") MultipartFile image) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        if (aiApiKey == null || aiApiKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "AI API key not configured. Set APP_AI_API_KEY environment variable."));
        }

        // Check AI usage quota
        Runner runner = user.get();
        String quotaError = aiUsageService.checkQuota(runner);
        if (quotaError != null) {
            Map<String, Object> errorBody = new LinkedHashMap<>();
            errorBody.put("error", quotaError);
            errorBody.putAll(aiUsageService.getUsageStatus(runner));
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(errorBody);
        }

        try {
            byte[] imageBytes = image.getBytes();
            String base64 = Base64.getEncoder().encodeToString(imageBytes);
            String mediaType = image.getContentType();
            if (mediaType == null || !mediaType.startsWith("image/")) {
                mediaType = "image/png";
            }

            String text;
            if ("claude".equalsIgnoreCase(aiProvider)) {
                text = callClaude(base64, mediaType);
            } else {
                text = callGemini(base64, mediaType);
            }

            if (text == null) {
                return ResponseEntity.ok(Map.of("shoes", List.of()));
            }

            // Extract JSON array from text (may have surrounding text)
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            if (start >= 0 && end > start) {
                String jsonArray = text.substring(start, end + 1);
                aiUsageService.recordUsage(runner);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("raw", jsonArray);
                result.putAll(aiUsageService.getUsageStatus(runner));
                return ResponseEntity.ok(result);
            }

            return ResponseEntity.ok(Map.of("shoes", List.of()));

        } catch (HttpStatusCodeException e) {
            System.err.println("AI API error " + e.getStatusCode() + ": " + e.getResponseBodyAsString());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "AI service temporarily unavailable. Please try again later."));
        } catch (Exception e) {
            System.err.println("Shoe image scan failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to analyze image. Please try again."));
        }
    }

    /** Google Gemini API (free tier available) */
    @SuppressWarnings("unchecked")
    private String callGemini(String base64, String mediaType) {
        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", mediaType,
                                        "data", base64
                                )),
                                Map.of("text", SHOE_PROMPT)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + aiModel + ":generateContent?key=" + aiApiKey;

        RestTemplate restTemplate = this.restTemplate;
        ResponseEntity<Map> response = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);

        Map body = response.getBody();
        if (body == null) return null;

        List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
        if (candidates == null || candidates.isEmpty()) return null;

        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        if (content == null) return null;

        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        if (parts == null || parts.isEmpty()) return null;

        return (String) parts.get(0).get("text");
    }

    /** Anthropic Claude API (fallback) */
    @SuppressWarnings("unchecked")
    private String callClaude(String base64, String mediaType) {
        Map<String, Object> request = Map.of(
                "model", aiModel,
                "max_tokens", 1024,
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of("type", "image",
                                        "source", Map.of(
                                                "type", "base64",
                                                "media_type", mediaType,
                                                "data", base64
                                        )),
                                Map.of("type", "text", "text", SHOE_PROMPT)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", aiApiKey);
        headers.set("anthropic-version", "2023-06-01");

        RestTemplate restTemplate = this.restTemplate;
        ResponseEntity<Map> response = restTemplate.exchange(
                "https://api.anthropic.com/v1/messages",
                HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);

        Map body = response.getBody();
        if (body == null) return null;

        List<Map<String, Object>> content = (List<Map<String, Object>>) body.get("content");
        if (content == null || content.isEmpty()) return null;

        return (String) content.get(0).get("text");
    }
}
