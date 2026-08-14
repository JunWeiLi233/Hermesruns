package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class BingImageScraper {
    private static final Logger logger = LoggerFactory.getLogger(BingImageScraper.class);

    private static final Pattern MEDIA_URL_PATTERN =
            Pattern.compile("mediaurl=(https?%3a%2f%2f[^&\"<>\\s]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MURL_BLOCK_PATTERN =
            Pattern.compile("\\{[^{}]{0,4096}\"murl\"\\s*:\\s*\"(https?://.*?)(?=\")[^{}]{0,4096}\\}", Pattern.CASE_INSENSITIVE);
    private static final Pattern MURL_PATTERN =
            Pattern.compile("\"murl\"\\s*:\\s*\"(https?://.*?)(?=\")", Pattern.CASE_INSENSITIVE);
    private static final Pattern NIKE_STATIC_IMAGE_PATTERN =
            Pattern.compile("https://static\\.nike\\.com/[^\"'<>\\s]+\\.(?:jpg|jpeg|png|webp|avif)", Pattern.CASE_INSENSITIVE);
    private static final int SINGLE_IMAGE_CANDIDATE_LIMIT = 12;
    private static final int SEARCH_CANDIDATE_MULTIPLIER = 4;
    private static final int SHOE_SEARCH_RESULT_LIMIT = 12;
    private static final int SHOE_SEARCH_PER_QUERY_LIMIT = 18;
    private static final int SHOE_SEARCH_AGGREGATE_LIMIT = 96;
    private static final long MAX_PIXEL_FILTER_IMAGE_BYTES = 5L * 1024L * 1024L;
    private static final List<String> POSITIVE_METADATA_TERMS = List.of(
            "shoe", "shoes", "running", "runner", "sneaker", "sneakers", "trainer",
            "white-background", "white_background", "product", "side-view", "side_view");
    private static final List<String> STRONG_SHOE_METADATA_TERMS = List.of(
            "shoe", "shoes", "running-shoe", "running_shoe", "running-shoes", "running_shoes",
            "sneaker", "sneakers", "trainer", "trainers", "footwear", "road-running",
            "road_running", "跑鞋", "运动鞋");
    // Metadata that, when seen together with a strong shoe term, marks a candidate as a
    // product-style shoe photo (white background / catalog framing). Used to admit real
    // running-shoe images even when the brand/model names are non-Latin (e.g. 361 飞飚)
    // and therefore never appear in the image URL or surrounding metadata.
    private static final List<String> SHOE_PRODUCT_EVIDENCE_TERMS = List.of(
            "white-background", "white_background", "white background", "whitebackground",
            "product", "side-view", "side_view", "side view",
            "plain-background", "plain_background", "solid-background", "solid_background",
            "catalog", "studio", "isolated", "running", "road-running", "road_running",
            "sneaker", "sneakers", "trainer", "footwear");
    private static final List<String> NEGATIVE_METADATA_TERMS = List.of(
            "logo", "box", "outfit", "person", "people", "review", "article", "blog",
            "banner", "poster", "wallpaper", "lifestyle", "lookbook", "apparel");
    private static final List<String> BLOCKING_METADATA_TERMS = List.of(
            "dog", "dogs", "pet", "pets", "cat", "cats", "agility", "ramp", "ramps",
            "kennel", "crate", "playground", "platform", "table", "bench", "stair",
            "stairs", "wooden", "wood", "furniture", "decking", "bracelet", "bracelets",
            "jewelry", "jewellery", "necklace", "necklaces", "anklet", "anklets",
            "ring", "rings", "bead", "beads", "beaded", "pendant", "charm",
            "album", "concert", "lyrics", "vinyl", "band");
    private static final List<String> SEARCH_EXCLUSION_TERMS = List.of(
            "dog", "pet", "agility", "ramp", "kennel", "crate", "table", "bench",
            "wooden", "furniture", "bracelet", "jewelry", "necklace", "beads",
            "ring", "album", "concert", "lyrics");
    private static final Set<String> GENERIC_QUERY_TOKENS = Set.of(
            "shoe", "shoes", "running", "runner", "sneaker", "sneakers", "trainer",
            "product", "image", "photo", "official", "white", "background", "side",
            "view", "men", "mens", "women", "womens", "跑鞋", "图片", "照片", "白底图",
            "主图", "官方", "官网", "男", "女");

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
    private static final Map<String, List<String>> BRAND_URL_NEEDLES = Map.ofEntries(
            Map.entry("nike", List.of("nike")),
            Map.entry("adidas", List.of("adidas")),
            Map.entry("asics", List.of("asics")),
            Map.entry("new balance", List.of("newbalance", "new-balance", "new_balance")),
            Map.entry("hoka", List.of("hoka")),
            Map.entry("brooks", List.of("brooks", "brooksrunning")),
            Map.entry("saucony", List.of("saucony")),
            Map.entry("on", List.of("on-running")),
            Map.entry("mizuno", List.of("mizuno")),
            Map.entry("altra", List.of("altra")),
            Map.entry("puma", List.of("puma")),
            Map.entry("reebok", List.of("reebok")),
            Map.entry("under armour", List.of("underarmour", "under-armour", "under_armour")),
            Map.entry("skechers", List.of("skechers")),
            Map.entry("361", List.of("361sport", "361degrees", "361度")),
            Map.entry("li ning", List.of("lining", "li-ning", "li_ning", "李宁")),
            Map.entry("anta", List.of("anta", "安踏")),
            Map.entry("xtep", List.of("xtep", "特步")),
            Map.entry("peak", List.of("peaksport", "peak-sport", "匹克"))
    );
    // Canonical Chinese brand aliases used to strengthen queries and metadata matching for
    // Chinese-market shoes, whose product images are indexed under the Chinese brand name.
    private static final Map<String, List<String>> BRAND_CN_ALIASES = Map.ofEntries(
            Map.entry("361", List.of("361度", "361°")),
            Map.entry("li ning", List.of("李宁")),
            Map.entry("anta", List.of("安踏")),
            Map.entry("xtep", List.of("特步")),
            Map.entry("peak", List.of("匹克"))
    );
    // Romanized / international model names for Chinese-brand shoes whose international CDN
    // listings (Ali/Taobao/Shopee/brand regional sites) are indexed under the pinyin name,
    // not the Chinese characters. Bing's image index matches these romanized names far better
    // than it matches the Chinese model name. Keys are lowercased for matching.
    private static final Map<String, List<String>> MODEL_ROMANIZATION = Map.ofEntries(
            Map.entry("飞飚", List.of("Feibiao")),
            Map.entry("飞燃", List.of("Feiran", "Flame")),
            Map.entry("飞电", List.of("Feidian")),
            Map.entry("绝影", List.of("Jueying")),
            Map.entry("赤兔", List.of("Chitu")),
            Map.entry("越影", List.of("Yueying")),
            Map.entry("烈骏", List.of("Liejun")),
            Map.entry("态极", List.of("Taiji", "State Extreme")),
            Map.entry("C202", List.of("C202 GT")),
            Map.entry("160X", List.of("160X"))
    );

    private final RestTemplate restTemplate;
    private final SafeUrlExecutor safeUrlExecutor;
    private final ShoeImagePixelAnalyzer shoeImagePixelAnalyzer;

    @Autowired
    public BingImageScraper(RestTemplate restTemplate, SafeUrlExecutor safeUrlExecutor) {
        this(restTemplate, safeUrlExecutor, new ShoeImagePixelAnalyzer());
    }

    BingImageScraper(RestTemplate restTemplate, SafeUrlExecutor safeUrlExecutor, ShoeImagePixelAnalyzer shoeImagePixelAnalyzer) {
        this.restTemplate = restTemplate;
        this.safeUrlExecutor = safeUrlExecutor;
        this.shoeImagePixelAnalyzer = shoeImagePixelAnalyzer;
    }

    public List<String> searchShoeImageCandidates(String brand, String model) {
        return searchShoeImageCandidates(brand, model, "", SHOE_SEARCH_RESULT_LIMIT);
    }

    public List<String> searchShoeImageCandidates(String brand, String model, String customQuery, int maxResults) {
        SearchContext context = SearchContext.from(brand, model, customQuery);
        if (context.isBlank() || maxResults <= 0) {
            return List.of();
        }

        LinkedHashMap<String, ImageCandidate> results = new LinkedHashMap<>();
        addImageCandidates(results, fetchOfficialBrandImageCandidates(context, SHOE_SEARCH_PER_QUERY_LIMIT));
        for (String query : buildShoeImageQueries(context)) {
            if (results.size() >= SHOE_SEARCH_AGGREGATE_LIMIT) {
                break;
            }
            addImageCandidates(results, fetchCandidateImageCandidates(bingImageUrl(query), SHOE_SEARCH_PER_QUERY_LIMIT));
        }

        return filterShoeImageCandidates(new ArrayList<>(results.values()), maxResults, context);
    }

    private List<String> buildShoeImageQueries(SearchContext context) {
        // Order matters: queries are executed in sequence under an aggregate candidate cap.
        // The most effective query families for a given brand/model must come first so they
        // are not crowded out by generic queries that return mostly noise. For Chinese-brand
        // shoes the romanized model name (e.g. "361 Feibiao") is the single best signal, so
        // those queries are emitted before the generic identity queries.
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        String identity = context.identityQuery();
        String custom = context.customQuery();
        String exclusions = negativeSearchClause();
        List<String> cnIdentityQueries = chineseIdentityQueries(context);
        List<String> romanizedIdentities = romanizedIdentities(context);

        // Highest priority first: romanized identities (best for Chinese brands on global CDN).
        for (String romanized : romanizedIdentities) {
            queries.add(romanized + " running shoe" + exclusions);
            queries.add(romanized + " running shoe white background");
            queries.add(romanized + " 跑鞋");
        }

        if (!custom.isBlank()) {
            if (context.brandDomain() != null) {
                queries.add(custom + " site:" + context.brandDomain() + " running shoe product image" + exclusions);
            }
            queries.add(custom + " running shoe sneaker product image" + exclusions);
            queries.add(custom + " running trainer shoe side view" + exclusions);
            queries.add(custom + " 跑鞋 白底图");
        }

        if (!identity.isBlank()) {
            if (context.brandDomain() != null) {
                queries.add(identity + " site:" + context.brandDomain() + " running shoe product image" + exclusions);
            }
            queries.add("\"" + identity + "\" running shoe sneaker product image" + exclusions);
            queries.add(identity + " running trainer shoe white background" + exclusions);
            queries.add(identity + " running shoe side view" + exclusions);
            queries.add(identity + " 跑鞋 白底图");
            queries.add(identity + " 跑鞋 官方 图");
            queries.add(identity + " 京东 白底图");
            queries.add(identity + " 得物 白底图");
        }

        // Chinese-market reinforcement: when the brand has a Chinese alias, the brand+model
        // tokens under that alias sometimes index better on Chinese commerce (Taobao/Tmall/
        // JD/Dewu) than the romanized identity does on Bing globally.
        for (String cnIdentity : cnIdentityQueries) {
            queries.add(cnIdentity + " 跑鞋 白底图");
            queries.add(cnIdentity + " 跑鞋 官方");
            queries.add(cnIdentity + " 跑鞋 淘宝");
            queries.add(cnIdentity + " 男鞋 实拍");
        }

        return new ArrayList<>(queries);
    }

    // Romanized brand+model identities for the current context, e.g.
    // brand="361" model="飞飚" -> ["361 Feibiao"], brand="Li-Ning" model="飞电 3 Ultra" -> ["Li-Ning Feidian 3 Ultra"].
    // Only emitted when the model carries a known romanization, because emitting the raw
    // Chinese model under an English query plan would not help (and Bing US returns noise).
    private static List<String> romanizedIdentities(SearchContext context) {
        if (context == null) {
            return List.of();
        }
        String model = context.model() == null ? "" : context.model().trim();
        if (model.isBlank()) {
            return List.of();
        }
        List<String> romanizedTokens = new ArrayList<>();
        boolean anyMapped = false;
        for (Map.Entry<String, List<String>> entry : MODEL_ROMANIZATION.entrySet()) {
            String cnModel = entry.getKey();
            if (model.contains(cnModel)) {
                anyMapped = true;
                // Prefer the first (most common) romanization; alternates are covered by
                // emitting one identity per romanization below.
                romanizedTokens.add(entry.getValue().get(0));
            }
        }
        if (!anyMapped) {
            return List.of();
        }
        String romanizedModel = model;
        for (Map.Entry<String, List<String>> entry : MODEL_ROMANIZATION.entrySet()) {
            romanizedModel = romanizedModel.replace(entry.getKey(), entry.getValue().get(0));
        }
        // Brand romanization: use the already-romanized brand key (e.g. "li ning" -> "Li-Ning",
        // "361" stays "361", "anta" -> "Anta"). For "li ning" prefer the hyphenated form used
        // in international listings.
        String brand = context.brandKey();
        String romanizedBrand = "li ning".equals(brand) ? "Li-Ning" : capitalized(brand);
        List<String> out = new ArrayList<>();
        out.add((romanizedBrand + " " + romanizedModel).trim());
        return out;
    }

    private static String capitalized(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String[] parts = value.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append(' ');
            String p = parts[i];
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }

    // Builds the brand+model identity written with the brand's Chinese alias, e.g.
    // brand="361" model="飞飚" -> ["361度 飞飚"]. Returns one variant per alias so both
    // "361度" and "361°" are tried. Empty when the brand has no Chinese alias.
    private static List<String> chineseIdentityQueries(SearchContext context) {
        if (context == null || context.brandKey().isBlank()) {
            return List.of();
        }
        List<String> aliases = BRAND_CN_ALIASES.get(context.brandKey());
        if (aliases == null || aliases.isEmpty()) {
            return List.of();
        }
        String model = context.model() == null ? "" : context.model().trim();
        List<String> out = new ArrayList<>();
        for (String alias : aliases) {
            String identity = (alias + " " + model).trim();
            if (!identity.isBlank()) {
                out.add(identity);
            }
        }
        return out;
    }

    public String scrapeShoeImage(String brand, String model) {
        List<String> candidates = searchShoeImageCandidates(brand, model, "", 1);
        return candidates.isEmpty() ? null : candidates.get(0);
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
        return filterShoeImageUrls(
                fetchCandidateImageUrls(searchUrl, Math.max(maxResults, maxResults * SEARCH_CANDIDATE_MULTIPLIER)),
                maxResults,
                SearchContext.empty());
    }

    private List<ImageCandidate> fetchOfficialBrandImageCandidates(SearchContext context, int maxCandidates) {
        if (context == null || maxCandidates <= 0 || !"nike".equals(context.brandKey())) {
            return List.of();
        }

        String query = context.productSearchQuery();
        if (query.isBlank()) {
            return List.of();
        }

        String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
        String searchUrl = "https://www.nike.com/w?q=" + encoded + "&vst=" + encoded;
        LinkedHashMap<String, ImageCandidate> candidates = new LinkedHashMap<>();
        try {
            String html = fetchBingHtml(searchUrl);
            if (html == null || html.length() < 100) {
                return List.of();
            }
            Matcher matcher = NIKE_STATIC_IMAGE_PATTERN.matcher(html);
            while (matcher.find() && candidates.size() < maxCandidates) {
                String url = normalizeImageUrl(matcher.group());
                if (isImageFileUrl(url)) {
                    addImageCandidate(candidates, new ImageCandidate(url, url), maxCandidates);
                }
            }
        } catch (Exception e) {
            logger.debug("Official Nike image search failed for {}: {}", query, e.getMessage());
        }
        return new ArrayList<>(candidates.values());
    }

    private List<String> fetchCandidateImageUrls(String searchUrl, int maxCandidates) {
        List<String> urls = new ArrayList<>();
        for (ImageCandidate candidate : fetchCandidateImageCandidates(searchUrl, maxCandidates)) {
            urls.add(candidate.imageUrl());
        }
        return urls;
    }

    private List<ImageCandidate> fetchCandidateImageCandidates(String searchUrl, int maxCandidates) {
        LinkedHashMap<String, ImageCandidate> candidates = new LinkedHashMap<>();
        try {
            String html = fetchBingHtml(searchUrl);
            if (html == null || html.length() < 100) return new ArrayList<>(candidates.values());

            addImageCandidates(candidates, extractCandidateImages(html, maxCandidates));
        } catch (Exception e) {
            logger.warn("Multi-image fetch failed: {}", e.getMessage(), e);
        }
        return new ArrayList<>(candidates.values());
    }

    public String fetchAndParse(String searchUrl) {
        try {
            String html = fetchBingHtml(searchUrl);
            if (html == null || html.length() < 100) {
                logger.warn("Bing returned empty/short response for: {}", searchUrl);
                return null;
            }

            List<ImageCandidate> candidates = extractCandidateImages(html, SINGLE_IMAGE_CANDIDATE_LIMIT);
            List<String> filtered = filterShoeImageCandidates(candidates, 1, SearchContext.empty());
            if (!filtered.isEmpty()) return filtered.get(0);
        } catch (Exception e) {
            logger.warn("Image fetch failed for {}: {}", searchUrl, e.getMessage(), e);
        }
        return null;
    }

    private List<String> extractCandidateImageUrls(String html, int maxCandidates) {
        List<String> urls = new ArrayList<>();
        for (ImageCandidate candidate : extractCandidateImages(html, maxCandidates)) {
            urls.add(candidate.imageUrl());
        }
        return urls;
    }

    private List<ImageCandidate> extractCandidateImages(String html, int maxCandidates) {
        if (html == null || html.isBlank() || maxCandidates <= 0) {
            return List.of();
        }

        String normalizedHtml = normalizeSearchHtml(html);
        LinkedHashMap<String, ImageCandidate> candidates = new LinkedHashMap<>();
        Matcher murlBlockMatcher = MURL_BLOCK_PATTERN.matcher(normalizedHtml);
        while (murlBlockMatcher.find() && candidates.size() < maxCandidates) {
            String url = normalizeImageUrl(murlBlockMatcher.group(1));
            if (isImageFileUrl(url)) {
                addImageCandidate(candidates, new ImageCandidate(url, decodeSearchMetadata(murlBlockMatcher.group())), maxCandidates);
            }
        }

        Matcher murlMatcher = MURL_PATTERN.matcher(normalizedHtml);
        while (murlMatcher.find() && candidates.size() < maxCandidates) {
            String url = normalizeImageUrl(murlMatcher.group(1));
            if (isImageFileUrl(url)) {
                addImageCandidate(candidates, new ImageCandidate(url, url), maxCandidates);
            }
        }

        Matcher mediaMatcher = MEDIA_URL_PATTERN.matcher(html);
        while (mediaMatcher.find() && candidates.size() < maxCandidates) {
            String url = java.net.URLDecoder.decode(mediaMatcher.group(1), StandardCharsets.UTF_8);
            url = normalizeImageUrl(url);
            if (isImageFileUrl(url)) {
                addImageCandidate(candidates, new ImageCandidate(url, url), maxCandidates);
            }
        }

        return new ArrayList<>(candidates.values());
    }

    private static void addImageCandidates(
            LinkedHashMap<String, ImageCandidate> target,
            List<ImageCandidate> candidates
    ) {
        if (target == null || candidates == null || candidates.isEmpty()) {
            return;
        }
        for (ImageCandidate candidate : candidates) {
            addImageCandidate(target, candidate, Integer.MAX_VALUE);
        }
    }

    private static void addImageCandidate(
            LinkedHashMap<String, ImageCandidate> target,
            ImageCandidate candidate,
            int maxCandidates
    ) {
        if (target == null || candidate == null || target.size() >= maxCandidates) {
            return;
        }
        String url = normalizeImageUrl(candidate.imageUrl());
        if (url.isBlank()) {
            return;
        }
        target.putIfAbsent(url, new ImageCandidate(url, candidate.metadata()));
    }

    private List<String> filterShoeImageUrls(List<String> urls, int maxResults) {
        return filterShoeImageUrls(urls, maxResults, SearchContext.empty());
    }

    private List<String> filterShoeImageUrls(List<String> urls, int maxResults, SearchContext context) {
        if (urls == null || urls.isEmpty() || maxResults <= 0) {
            return List.of();
        }

        List<ImageCandidate> candidates = new ArrayList<>();
        for (String url : new LinkedHashSet<>(urls)) {
            candidates.add(new ImageCandidate(url, url));
        }
        return filterShoeImageCandidates(candidates, maxResults, context);
    }

    private List<String> filterShoeImageCandidates(List<ImageCandidate> candidates, int maxResults, SearchContext context) {
        if (candidates == null || candidates.isEmpty() || maxResults <= 0) {
            return List.of();
        }

        List<ImageCandidate> sorted = new ArrayList<>(new LinkedHashSet<>(candidates));
        sorted.sort(Comparator.comparingInt((ImageCandidate candidate) -> relevanceScore(candidate, context)).reversed());

        List<String> filtered = new ArrayList<>();
        for (ImageCandidate candidate : sorted) {
            if (filtered.size() >= maxResults) {
                break;
            }
            if (passesShoeImageGate(candidate, context)) {
                filtered.add(candidate.imageUrl());
            }
        }
        return filtered;
    }

    private boolean passesShoeImageGate(ImageCandidate candidate, SearchContext context) {
        String url = candidate.imageUrl();
        if (referencesDifferentBrand(candidate, context)) {
            logger.debug("Rejected shoe image candidate {}: different shoe brand in URL", url);
            return false;
        }
        if (referencesBlockedObjectType(candidate)) {
            logger.debug("Rejected shoe image candidate {}: blocked non-shoe object metadata", url);
            return false;
        }
        if (referencesConflictingModelVersion(candidate, context)) {
            logger.debug("Rejected shoe image candidate {}: conflicting shoe model version in URL", url);
            return false;
        }
        if (missingRequestedModelVersion(candidate, context)) {
            logger.debug("Rejected shoe image candidate {}: missing requested shoe model version metadata", url);
            return false;
        }
        if (!hasShoeTypeEvidence(candidate, context)) {
            logger.debug("Rejected shoe image candidate {}: no shoe metadata evidence", url);
            return false;
        }
        if (hasHighConfidenceShoeMetadata(candidate, context)) {
            return true;
        }

        try {
            byte[] imageBytes = fetchCandidateImageBytes(url);
            if (imageBytes.length == 0) {
                return false;
            }

            ShoeImagePixelAnalyzer.Analysis analysis = shoeImagePixelAnalyzer.analyze(imageBytes);
            if (!analysis.looksLikeShoe()) {
                logger.debug("Rejected shoe image candidate {}: {}", url, analysis.reason());
            }
            return analysis.looksLikeShoe();
        } catch (Exception ex) {
            logger.debug("Unable to pixel-filter shoe image candidate {}: {}", url, ex.getMessage());
            return false;
        }
    }

    private byte[] fetchCandidateImageBytes(String url) {
        String safeUrl = SafeUrlValidator.validateHttpUrlOrNull(url, 2000, "imageUrl");
        if (safeUrl == null) {
            return new byte[0];
        }

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        headers.set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

        org.springframework.http.ResponseEntity<byte[]> response = safeUrlExecutor.exchange(
                safeUrl,
                org.springframework.http.HttpMethod.GET,
                new org.springframework.http.HttpEntity<>(headers),
                byte[].class);
        if (response == null) {
            return new byte[0];
        }

        byte[] body = response.getBody();
        if (body == null || body.length == 0 || body.length > MAX_PIXEL_FILTER_IMAGE_BYTES) {
            return new byte[0];
        }

        org.springframework.http.MediaType contentType = response.getHeaders().getContentType();
        if (contentType != null && !contentType.toString().toLowerCase().startsWith("image/")) {
            return new byte[0];
        }
        return body;
    }

    private int metadataScore(ImageCandidate candidate) {
        String lower = candidate.searchableMetadata();
        int score = 0;
        for (String term : POSITIVE_METADATA_TERMS) {
            if (lower.contains(term)) {
                score += 2;
            }
        }
        for (String term : NEGATIVE_METADATA_TERMS) {
            if (lower.contains(term)) {
                score -= 4;
            }
        }
        if (lower.contains("product") || lower.contains("white")) {
            score += 1;
        }
        return score;
    }

    private int relevanceScore(ImageCandidate candidate, SearchContext context) {
        int score = metadataScore(candidate);
        if (context == null || context.isBlank()) {
            return score;
        }
        if (referencesDifferentBrand(candidate, context)) {
            return -100;
        }

        String searchable = candidate.searchableMetadata();
        String host = urlHost(candidate.imageUrl());
        if (context.brandDomain() != null && host.endsWith(context.brandDomain())) {
            score += 20;
        }

        boolean brandHit = false;
        for (String needle : context.brandNeedles()) {
            if (containsNeedle(searchable, needle)) {
                brandHit = true;
                score += 10;
                break;
            }
        }

        int modelHits = 0;
        for (String token : context.modelTokens()) {
            if (containsNeedle(searchable, token)) {
                modelHits++;
                score += token.chars().allMatch(Character::isDigit) ? 3 : 5;
            }
        }

        int queryHits = 0;
        for (String token : context.customTokens()) {
            if (queryHits >= 4) {
                break;
            }
            if (containsNeedle(searchable, token)) {
                queryHits++;
                score += 1;
            }
        }

        if (!context.brandNeedles().isEmpty() && !brandHit && modelHits == 0) {
            score -= 6;
        } else if (!context.modelTokens().isEmpty() && modelHits == 0) {
            score -= 2;
        }
        return score;
    }

    private boolean referencesDifferentBrand(ImageCandidate candidate, SearchContext context) {
        if (context == null || context.brandKey().isBlank()) {
            return false;
        }
        String searchable = candidate.searchableMetadata();
        for (Map.Entry<String, List<String>> entry : BRAND_URL_NEEDLES.entrySet()) {
            String brandKey = entry.getKey();
            if (brandKey.equals(context.brandKey())) {
                continue;
            }
            for (String needle : entry.getValue()) {
                if (containsNeedle(searchable, needle)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean referencesBlockedObjectType(ImageCandidate candidate) {
        String searchable = candidate.searchableMetadata();
        for (String term : BLOCKING_METADATA_TERMS) {
            if (containsMetadataToken(searchable, term)) {
                return true;
            }
        }
        return false;
    }

    private boolean referencesConflictingModelVersion(ImageCandidate candidate, SearchContext context) {
        if (context == null || context.versionTokens().isEmpty()) {
            return false;
        }

        String searchable = candidate.searchableMetadata();
        List<String> urlTokens = tokenize(searchable);
        if (containsAnyToken(urlTokens, context.versionTokens())) {
            return false;
        }

        List<String> familyTokens = productFamilyTokens(context);
        if (familyTokens.isEmpty() || !containsAnyNeedle(searchable, familyTokens)) {
            return false;
        }

        for (String token : urlTokens) {
            if (!isLikelyVersionToken(token)) {
                continue;
            }
            for (String requestedVersion : context.versionTokens()) {
                if (token.length() == requestedVersion.length()) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean missingRequestedModelVersion(ImageCandidate candidate, SearchContext context) {
        if (!requiresExactModelVersionEvidence(context)) {
            return false;
        }
        return !containsAnyToken(tokenize(candidate.searchableMetadata()), context.versionTokens());
    }

    private boolean hasShoeTypeEvidence(ImageCandidate candidate, SearchContext context) {
        if (context == null || context.isBlank()) {
            return true;
        }

        String searchable = candidate.searchableMetadata();
        String host = urlHost(candidate.imageUrl());
        if (context.brandDomain() != null && host.endsWith(context.brandDomain())) {
            return true;
        }
        boolean brandHit = containsAnyNeedle(searchable, context.brandNeedles());
        boolean modelHit = containsAnyNeedle(searchable, context.modelTokens());
        boolean customSpecificHit = containsAnyNeedleExcept(searchable, context.customTokens(), context.brandNeedles());
        boolean shoeTypeHit = containsAnyNeedle(searchable, STRONG_SHOE_METADATA_TERMS);
        boolean productEvidenceHit = containsAnyNeedle(searchable, SHOE_PRODUCT_EVIDENCE_TERMS);

        return brandHit && (modelHit || customSpecificHit)
                || shoeTypeHit && (brandHit || modelHit || customSpecificHit)
                // A catalog-style running-shoe photo (e.g. "...running-shoe-sneakers-white-background...jpg")
                // is valid shoe evidence even when the brand/model names are non-Latin and cannot appear
                // in the URL. The pixel analyzer still rejects non-shoe objects downstream.
                || shoeTypeHit && productEvidenceHit;
    }

    private boolean hasHighConfidenceShoeMetadata(ImageCandidate candidate, SearchContext context) {
        if (context == null || context.isBlank()) {
            return false;
        }

        String searchable = candidate.searchableMetadata();
        String host = urlHost(candidate.imageUrl());
        if (context.brandDomain() != null && host.endsWith(context.brandDomain())) {
            return true;
        }
        boolean brandHit = containsAnyNeedle(searchable, context.brandNeedles());
        boolean modelHit = containsAnyNeedle(searchable, context.modelTokens());
        boolean customSpecificHit = containsAnyNeedleExcept(searchable, context.customTokens(), context.brandNeedles());
        return brandHit && (modelHit || customSpecificHit);
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
        // form=HDRSC2 marks the request as a real Bing Images entry so the image
        // index is used. Without it Bing returns a degraded SERP whose murl results
        // are unrelated to the query (cars, parks, infographic templates, ...).
        return "https://www.bing.com/images/search?q="
                + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&first=1&form=HDRSC2";
    }

    public boolean isImageFileUrl(String url) {
        if (url == null || !url.startsWith("http")) return false;
        String lower = url.toLowerCase();
        if (lower.contains(".html") || lower.contains(".htm")) return false;
        return lower.contains(".jpg") || lower.contains(".jpeg") ||
               lower.contains(".png") || lower.contains(".webp") ||
               lower.contains(".gif") || lower.contains(".avif");
    }

    private static String searchableUrl(String url) {
        if (url == null) return "";
        String decoded;
        try {
            decoded = java.net.URLDecoder.decode(url, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            decoded = url;
        }
        return decoded.toLowerCase(Locale.ROOT);
    }

    private static String normalizeImageUrl(String url) {
        if (url == null) return "";
        return url
                .replace("\\/", "/")
                .replace("\\u0026", "&")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .trim();
    }

    private static String normalizeSearchHtml(String html) {
        if (html == null) return "";
        return html
                .replace("\\/", "/")
                .replace("\\u0026", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&");
    }

    private static String decodeSearchMetadata(String value) {
        if (value == null) return "";
        String decoded = normalizeSearchHtml(value).trim();
        try {
            return java.net.URLDecoder.decode(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return decoded;
        }
    }

    private static String urlHost(String url) {
        try {
            String host = URI.create(url).getHost();
            return host == null ? "" : host.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }

    private static boolean containsNeedle(String value, String needle) {
        if (value == null || needle == null || needle.isBlank()) return false;
        return value.contains(needle.toLowerCase(Locale.ROOT));
    }

    private static boolean containsAnyNeedle(String value, List<String> needles) {
        if (value == null || needles == null || needles.isEmpty()) return false;
        for (String needle : needles) {
            if (containsNeedle(value, needle)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsAnyNeedleExcept(String value, List<String> needles, List<String> excludedNeedles) {
        if (value == null || needles == null || needles.isEmpty()) return false;
        for (String needle : needles) {
            if (containsNeedle(value, needle) && !matchesAnyNeedle(needle, excludedNeedles)) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesAnyNeedle(String value, List<String> needles) {
        if (value == null || needles == null || needles.isEmpty()) return false;
        for (String needle : needles) {
            if (value.equalsIgnoreCase(needle)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsAnyToken(List<String> tokens, List<String> expectedTokens) {
        if (tokens == null || tokens.isEmpty() || expectedTokens == null || expectedTokens.isEmpty()) {
            return false;
        }
        for (String token : tokens) {
            if (matchesAnyNeedle(token, expectedTokens)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsMetadataToken(String value, String token) {
        if (value == null || token == null || token.isBlank()) return false;
        String expected = token.toLowerCase(Locale.ROOT);
        Matcher matcher = Pattern.compile("[\\p{L}\\p{N}]+").matcher(value);
        while (matcher.find()) {
            if (matcher.group().equals(expected)) {
                return true;
            }
        }
        return false;
    }

    private static String negativeSearchClause() {
        StringBuilder clause = new StringBuilder();
        for (String term : SEARCH_EXCLUSION_TERMS) {
            clause.append(" -").append(term);
        }
        return clause.toString();
    }

    private static String brandKey(String brand) {
        String key = String.join(" ", tokenize(brand));
        if (key.equals("361 degrees") || key.equals("361 度")) {
            return "361";
        }
        if (key.equals("li ning")) {
            return "li ning";
        }
        // Normalize Chinese brand names to their canonical romanized brand key so that
        // alias/needle/romanization lookups work regardless of whether the user typed the
        // brand in Chinese (李宁/安踏/特步/匹克) or romanized (Li-Ning/Anta/Xtep/Peak).
        switch (key) {
            case "李宁": return "li ning";
            case "安踏": return "anta";
            case "特步": return "xtep";
            case "匹克": return "peak";
            default: return key;
        }
    }

    private static String resolveBrandDomain(String brand) {
        String direct = brand == null ? "" : brand.toLowerCase(Locale.ROOT).trim();
        String domain = BRAND_DOMAINS.get(direct);
        if (domain != null) {
            return domain;
        }
        return BRAND_DOMAINS.get(brandKey(brand));
    }

    private static String detectBrandFromQuery(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        List<String> tokens = tokenize(query);
        for (String brand : BRAND_DOMAINS.keySet()) {
            String key = brandKey(brand);
            if (key.isBlank() || key.equals("on")) {
                continue;
            }
            List<String> brandTokens = tokenize(key);
            if (!brandTokens.isEmpty() && containsTokenSequence(tokens, brandTokens)) {
                return key;
            }
        }
        return "";
    }

    private static String removeBrandTokens(String query, String brand) {
        if (query == null || query.isBlank() || brand == null || brand.isBlank()) {
            return query == null ? "" : query.trim();
        }

        List<String> queryTokens = tokenize(query);
        List<String> brandTokens = tokenize(brandKey(brand));
        if (queryTokens.isEmpty() || brandTokens.isEmpty()) {
            return query.trim();
        }

        List<String> kept = new ArrayList<>();
        for (int index = 0; index < queryTokens.size();) {
            boolean matchesBrand = index <= queryTokens.size() - brandTokens.size();
            if (matchesBrand) {
                for (int offset = 0; offset < brandTokens.size(); offset++) {
                    if (!queryTokens.get(index + offset).equals(brandTokens.get(offset))) {
                        matchesBrand = false;
                        break;
                    }
                }
            }
            if (matchesBrand) {
                index += brandTokens.size();
            } else {
                kept.add(queryTokens.get(index));
                index++;
            }
        }
        return String.join(" ", kept).trim();
    }

    private static List<String> brandNeedles(String brand) {
        String key = brandKey(brand);
        LinkedHashSet<String> needles = new LinkedHashSet<>();
        if (BRAND_URL_NEEDLES.containsKey(key)) {
            needles.addAll(BRAND_URL_NEEDLES.get(key));
        }
        for (String token : tokenize(brand)) {
            if (isSignificantNeedle(token)) {
                needles.add(token);
            }
        }
        String compact = compactToken(brand);
        if (compact.length() > 1) {
            needles.add(compact);
        }
        return new ArrayList<>(needles);
    }

    private static List<String> significantTokens(String value) {
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        for (String token : tokenize(value)) {
            if (GENERIC_QUERY_TOKENS.contains(token)) {
                continue;
            }
            boolean numeric = token.chars().allMatch(Character::isDigit);
            if (isSignificantNeedle(token) || numeric && token.length() >= 2) {
                tokens.add(token);
            }
        }
        return new ArrayList<>(tokens);
    }

    private static List<String> versionTokens(String... values) {
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        if (values == null) {
            return List.of();
        }
        for (String value : values) {
            for (String token : tokenize(value)) {
                if (isLikelyVersionToken(token)) {
                    tokens.add(token);
                }
            }
        }
        return new ArrayList<>(tokens);
    }

    private static List<String> productFamilyTokens(SearchContext context) {
        if (context == null) {
            return List.of();
        }
        LinkedHashSet<String> tokens = new LinkedHashSet<>();
        addProductFamilyTokens(tokens, context.modelTokens(), context);
        addProductFamilyTokens(tokens, context.customTokens(), context);
        return new ArrayList<>(tokens);
    }

    private static void addProductFamilyTokens(
            LinkedHashSet<String> target,
            List<String> candidates,
            SearchContext context
    ) {
        if (candidates == null) {
            return;
        }
        for (String token : candidates) {
            if (isLikelyVersionToken(token)
                    || GENERIC_QUERY_TOKENS.contains(token)
                    || matchesAnyNeedle(token, context.brandNeedles())
                    || !isSignificantNeedle(token)) {
                continue;
            }
            target.add(token);
        }
    }

    private static boolean requiresExactModelVersionEvidence(SearchContext context) {
        return context != null
                && !context.versionTokens().isEmpty()
                && !productFamilyTokens(context).isEmpty();
    }

    private static boolean isLikelyVersionToken(String token) {
        return token != null
                && !token.isBlank()
                && token.length() <= 4
                && token.chars().allMatch(Character::isDigit);
    }

    private static boolean isMoreSpecificProductQuery(String query, String model) {
        if (query == null || query.isBlank()) {
            return false;
        }
        if (model == null || model.isBlank()) {
            return true;
        }

        List<String> queryTokens = significantTokens(query);
        List<String> modelTokens = significantTokens(model);
        if (queryTokens.isEmpty() || modelTokens.isEmpty()) {
            return false;
        }

        boolean overlapsModelFamily = false;
        for (String token : modelTokens) {
            if (!isLikelyVersionToken(token) && queryTokens.contains(token)) {
                overlapsModelFamily = true;
                break;
            }
        }
        if (!overlapsModelFamily) {
            return false;
        }

        if (queryTokens.size() > modelTokens.size()) {
            return true;
        }
        List<String> modelVersions = versionTokens(model);
        for (String queryVersion : versionTokens(query)) {
            if (!modelVersions.contains(queryVersion)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isSignificantNeedle(String token) {
        if (token == null || token.isBlank()) return false;
        boolean numeric = token.chars().allMatch(Character::isDigit);
        return token.length() >= 3
                || numeric && token.length() >= 2
                || token.codePoints().anyMatch(code -> Character.UnicodeScript.of(code) == Character.UnicodeScript.HAN);
    }

    private static List<String> tokenize(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        Matcher matcher = Pattern.compile("[\\p{L}\\p{N}]+").matcher(value.toLowerCase(Locale.ROOT));
        List<String> tokens = new ArrayList<>();
        while (matcher.find()) {
            tokens.add(matcher.group());
        }
        return tokens;
    }

    private static boolean containsTokenSequence(List<String> tokens, List<String> sequence) {
        if (tokens == null || sequence == null || tokens.isEmpty() || sequence.isEmpty()) {
            return false;
        }
        for (int start = 0; start <= tokens.size() - sequence.size(); start++) {
            boolean matches = true;
            for (int offset = 0; offset < sequence.size(); offset++) {
                if (!tokens.get(start + offset).equals(sequence.get(offset))) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                return true;
            }
        }
        return false;
    }

    private static String compactToken(String value) {
        if (value == null) return "";
        return String.join("", tokenize(value));
    }

    private record ImageCandidate(String imageUrl, String metadata) {
        ImageCandidate {
            imageUrl = imageUrl == null ? "" : imageUrl;
            metadata = metadata == null || metadata.isBlank() ? imageUrl : metadata;
        }

        String searchableMetadata() {
            return searchableUrl(imageUrl + " " + metadata);
        }
    }

    private record SearchContext(
            String brand,
            String model,
            String customQuery,
            String brandKey,
            String brandDomain,
            List<String> brandNeedles,
            List<String> modelTokens,
            List<String> customTokens,
            List<String> versionTokens
    ) {
        static SearchContext empty() {
            return new SearchContext("", "", "", "", null, List.of(), List.of(), List.of(), List.of());
        }

        static SearchContext from(String brand, String model, String customQuery) {
            String safeBrand = brand == null ? "" : brand.trim();
            String safeModel = model == null ? "" : model.trim();
            String safeQuery = customQuery == null ? "" : customQuery.trim();
            if (safeBrand.isBlank()) {
                safeBrand = BingImageScraper.detectBrandFromQuery(safeQuery);
            }
            return new SearchContext(
                    safeBrand,
                    safeModel,
                    safeQuery,
                    BingImageScraper.brandKey(safeBrand),
                    BingImageScraper.resolveBrandDomain(safeBrand),
                    BingImageScraper.brandNeedles(safeBrand),
                    BingImageScraper.significantTokens(safeModel),
                    BingImageScraper.significantTokens(safeQuery),
                    BingImageScraper.versionTokens(safeModel, safeQuery)
            );
        }

        boolean isBlank() {
            return brand.isBlank() && model.isBlank() && customQuery.isBlank();
        }

        String identityQuery() {
            return (brand + " " + model).trim();
        }

        String productSearchQuery() {
            if (!customQuery.isBlank()) {
                String query = removeBrandTokens(customQuery, brand);
                if (!query.isBlank() && isMoreSpecificProductQuery(query, model)) {
                    return query;
                }
            }
            if (!model.isBlank()) {
                return model;
            }
            if (!customQuery.isBlank()) {
                String query = removeBrandTokens(customQuery, brand);
                return query.isBlank() ? customQuery : query;
            }
            return identityQuery();
        }
    }
}
