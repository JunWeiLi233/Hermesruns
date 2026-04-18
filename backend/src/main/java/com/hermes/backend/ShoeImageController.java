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
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> QUERY_ONLY_FIELDS = Set.of("query");
    private static final Set<String> PHOTO_ONLY_FIELDS = Set.of("photoUrl");

    private final AuthService authService;
    private final AiUsageService aiUsageService;
    private final RestTemplate restTemplate;
    private final SystemConfigService systemConfigService;
    private final ApiRateLimiter apiRateLimiter;

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
            "Return at most 10 elements in the JSON array. " +
            "Example: [{\"brand\":\"Nike\",\"model\":\"Pegasus 41\",\"distanceKm\":342.5}]";

    private final ShoeRepository shoeRepository;

    // Bing uses mediaurl=URL_ENCODED in href attributes
    private static final Pattern MEDIA_URL_PATTERN =
            Pattern.compile("mediaurl=(https?%3a%2f%2f[^&\"]+)", Pattern.CASE_INSENSITIVE);

    // Prevent resource exhaustion and limit what we send to 3rd-party AI.
    private static final long MAX_SCAN_IMAGE_BYTES = 6L * 1024L * 1024L; // 6MB

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

    public ShoeImageController(
            AuthService authService,
            ShoeRepository shoeRepository,
            AiUsageService aiUsageService,
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            ApiRateLimiter apiRateLimiter) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.aiUsageService = aiUsageService;
        this.restTemplate = restTemplate;
        this.systemConfigService = systemConfigService;
        this.apiRateLimiter = apiRateLimiter;
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
            m.put("photoVerified", s.isPhotoVerified());
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
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, QUERY_ONLY_FIELDS);
            Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
            if (user.isEmpty() || !authService.isAdmin(user.get()))
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

            Optional<Shoe> shoeOpt = shoeRepository.findById(id);
            if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

            Shoe shoe = shoeOpt.get();
            String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
            String model = shoe.getModel() != null ? shoe.getModel() : "";
            String customQuery = extractQuery(body);

            List<String> images;
            if (!customQuery.isBlank()) {
                images = scrapeMultipleImages(customQuery, 12);
            } else {
                images = searchShoeImageCandidates(brand, model);
            }
            return ResponseEntity.ok(Map.of("images", sanitizeImageUrls(images)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        } catch (Exception e) {
            System.err.println("Admin image search failed for shoe " + id + ": " + e.getMessage());
            return ResponseEntity.ok(Map.of("images", List.of(), "error", "search_failed"));
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
            @RequestBody Map<String, Object> body) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        final String photoUrlRaw;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, PHOTO_ONLY_FIELDS);
            photoUrlRaw = RequestBodyValidator.optionalString(body, "photoUrl", MAX_PHOTO_REFERENCE_LENGTH);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        String finalUrl;
        try {
            finalUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(photoUrlRaw, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        // Apply to ALL shoes with same brand+model
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            for (Shoe s : matching) {
                s.setPhotoUrl(finalUrl);
                s.setPhotoVerified(false);
                shoeRepository.save(s);
                count++;
            }
        } else {
            shoe.setPhotoUrl(finalUrl);
            shoe.setPhotoVerified(false);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of(
                "photoUrl", finalUrl != null ? finalUrl : "",
                "updated", count
        ));
    }

    /**
     * Admin: mark the current product image as verified for this shoe model (all same brand+model rows).
     */
    @PutMapping("/admin/{id}/verify-photo")
    public ResponseEntity<?> adminVerifyPhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        if (shoe.getPhotoUrl() == null || shoe.getPhotoUrl().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "no_photo"));
        }

        String canonicalUrl = shoe.getPhotoUrl().trim();
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            for (Shoe s : matching) {
                String pu = s.getPhotoUrl();
                if (pu != null && pu.trim().equals(canonicalUrl)) {
                    s.setPhotoVerified(true);
                    shoeRepository.save(s);
                    count++;
                }
            }
        } else {
            shoe.setPhotoVerified(true);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of("photoVerified", true, "updated", count));
    }

    /**
     * Admin: unmark current product image verification for this shoe model
     * (all same brand+model rows that share the same image URL).
     */
    @PutMapping("/admin/{id}/unverify-photo")
    public ResponseEntity<?> adminUnverifyPhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty() || !authService.isAdmin(user.get()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Admin only");

        Optional<Shoe> shoeOpt = shoeRepository.findById(id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        if (shoe.getPhotoUrl() == null || shoe.getPhotoUrl().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "no_photo"));
        }

        String canonicalUrl = shoe.getPhotoUrl().trim();
        String brand = shoe.getBrand();
        String model = shoe.getModel();
        int count = 0;
        if (brand != null && model != null) {
            List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
            for (Shoe s : matching) {
                String pu = s.getPhotoUrl();
                if (pu != null && pu.trim().equals(canonicalUrl)) {
                    s.setPhotoVerified(false);
                    shoeRepository.save(s);
                    count++;
                }
            }
        } else {
            shoe.setPhotoVerified(false);
            shoeRepository.save(shoe);
            count = 1;
        }

        return ResponseEntity.ok(Map.of("photoVerified", false, "updated", count));
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
            @RequestBody(required = false) Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        String brand = shoe.getBrand() != null ? shoe.getBrand() : "";
        String model = shoe.getModel() != null ? shoe.getModel() : "";
        String customQuery = extractQuery(body);

        try {
            List<String> images;
            if (!customQuery.isBlank()) {
                images = scrapeMultipleImages(customQuery, 12);
            } else {
                images = searchShoeImageCandidates(brand, model);
            }
            return ResponseEntity.ok(Map.of("images", sanitizeImageUrls(images)));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        } catch (Exception e) {
            System.err.println("Image search failed: " + e.getMessage());
            return ResponseEntity.ok(Map.of("images", List.of(), "error", "search_failed"));
        }
    }

    /**
     * Set or clear a shoe's photo URL directly.
     */
    @PutMapping("/{id}/photo")
    public ResponseEntity<?> setShoePhoto(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        final String photoUrlRaw;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, PHOTO_ONLY_FIELDS);
            photoUrlRaw = RequestBodyValidator.optionalString(body, "photoUrl", MAX_PHOTO_REFERENCE_LENGTH);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        String finalUrl;
        try {
            finalUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(photoUrlRaw, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        shoe.setPhotoUrl(finalUrl);
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

        // Strategy 1: User-requested E-commerce platforms with sterile "White Background" or "Main Image" modifiers
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 京东 白底图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 淘宝 主图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 拼多多 主图"), 4));

        // Strategy 2: Poizon (得物) - Best industry source for 360-degree floating shoe images
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 得物 白底图"), 4));
        
        // Strategy 3: Brand official website domains
        String domain = BRAND_DOMAINS.get(brandLower);
        if (domain != null) {
            results.addAll(fetchMultipleImages(bingImageUrl(brand + " " + model + " site:" + domain), 4));
        }
        
        // Strategy 4: Fallback generic clean images targeting Chinese review sites or english
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " 跑鞋 透底图"), 4));
        results.addAll(fetchMultipleImages(bingImageUrl(cnQuery + " running shoe white background"), 4));

        return new ArrayList<>(results);
    }

    private String scrapeShoeImage(String brand, String model) {
        String brandLower = brand.toLowerCase().trim();
        String cnQuery = brand + " " + model + " 跑鞋";

        // Strategy 1: JD / Taobao / PDD / DeWu catalogue imagery (White backgrounds)
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

        // Strategy 2: Brand official website domains
        String domain = BRAND_DOMAINS.get(brandLower);
        if (domain != null) {
            String result = fetchAndParse(bingImageUrl(brand + " " + model + " site:" + domain));
            if (result != null) return result;
        }

        // Strategy 3: Site restrictive (original fallbacks)
        String result = fetchAndParse(bingImageUrl(cnQuery + " site:jd.com"));
        if (result != null) return result;
        result = fetchAndParse(bingImageUrl(cnQuery + " site:taobao.com"));
        if (result != null) return result;

        // Strategy 4: Fallback generic clean images
        result = fetchAndParse(bingImageUrl(cnQuery + " 跑鞋 白底图"));
        if (result != null) return result;

        return fetchAndParse(bingImageUrl(brand + " " + model + " running shoe white background"));
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
        if (lower.contains(".html") || lower.contains(".htm")) return false;
        return lower.contains(".jpg") || lower.contains(".jpeg") ||
               lower.contains(".png") || lower.contains(".webp") ||
               lower.contains(".gif") || lower.contains(".avif");
    }

    private String extractQuery(Map<String, ?> body) {
        if (body == null) return "";
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, QUERY_ONLY_FIELDS);
            Object raw = body.get("query");
            String q = raw == null ? "" : String.valueOf(raw).trim();
            if (q.length() > 200) {
                q = q.substring(0, 200);
            }
            InputSanitizer.rejectControlAndHtmlChars(q, "query");
            return q;
        } catch (Exception ignored) {
            return "";
        }
    }

    private List<String> sanitizeImageUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String u : urls) {
            if (isImageFileUrl(u)) out.add(u);
        }
        return new ArrayList<>(out);
    }

    @GetMapping("/scan-available")
    public ResponseEntity<?> isScanAvailable(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        // Use centralized config check so status logic is consistent.
        boolean available = systemConfigService.isAiConfigured();
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
            @RequestParam("image") MultipartFile image,
            jakarta.servlet.http.HttpServletRequest request) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        String ip = RequestIpResolver.clientIp(request);
        // Extra abuse protection (in addition to quota): limit AI calls per IP
        if (!apiRateLimiter.allow("ai-scan:" + ip, 30, 3600)) { // 30/hour per IP
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too many AI requests. Try again later."));
        }

        if (!systemConfigService.isAiConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "AI API key not configured. Set APP_AI_API_KEY environment variable."));
        }

        // Check and atomically reserve AI usage quota
        Runner runner = user.get();
        String quotaError = aiUsageService.tryConsumeQuota(runner);
        if (quotaError != null) {
            Map<String, Object> errorBody = new LinkedHashMap<>();
            errorBody.put("error", quotaError);
            errorBody.putAll(aiUsageService.getUsageStatus(runner));
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(errorBody);
        }

        try {
            if (image == null || image.isEmpty() || image.getSize() <= 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Image is required."));
            }
            if (image.getSize() > MAX_SCAN_IMAGE_BYTES) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Image too large."));
            }

            String mediaType = image.getContentType();
            if (mediaType == null || !mediaType.toLowerCase(Locale.ROOT).startsWith("image/")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid image content type."));
            }

            byte[] imageBytes = image.getBytes();
            String base64 = Base64.getEncoder().encodeToString(imageBytes);

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
