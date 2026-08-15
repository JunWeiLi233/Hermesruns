package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BingImageScraperTests {

    @Test
    void shoeSearchRanksExactBrandAndRejectsDifferentBrandUrl() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String nikeUrl = "https://static.nike.com/a/images/pegasus-41-running-shoe-product.png";
        String adidasUrl = "https://assets.adidas.com/images/ultraboost-running-shoe-product.jpg";
        String genericUrl = "https://cdn.example.com/catalog/running-shoe-product-white-background.jpg";
        String html = bingHtml(adidasUrl, nikeUrl, genericUrl);
        byte[] shoeBytes = shoeLikePngBytes();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(shoeBytes));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates(
                "Nike",
                "Pegasus 41",
                "fast daily trainer",
                3
        );

        assertFalse(results.isEmpty(), "Expected at least one relevant Nike candidate.");
        assertEquals(nikeUrl, results.get(0));
        assertFalse(
                results.stream().anyMatch(url -> url.contains("adidas")),
                "Search results should reject URLs that clearly belong to another shoe brand."
        );

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        List<String> decodedQueries = searchUrlCaptor.getAllValues().stream()
                .map(BingImageScraperTests::decodeUrl)
                .collect(Collectors.toList());
        assertTrue(
                decodedQueries.stream().anyMatch(url -> url.contains("site:nike.com")),
                "Official brand-domain search should be part of the query plan."
        );
        assertTrue(
                decodedQueries.stream().anyMatch(url -> url.contains("fast daily trainer running shoe sneaker product image")),
                "Custom query should be strengthened with running-shoe product terms instead of raw image search."
        );
        assertTrue(
                decodedQueries.stream().anyMatch(url -> url.contains("-dog") && url.contains("-ramp")),
                "Running-shoe searches should exclude common non-shoe Pegasus product categories."
        );
    }

    @Test
    void shoeSearchRejectsPetRampAndPlatformMetadataForPegasusQueries() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String dogRampUrl = "https://cdn.example.com/pet/dog-agility-ramp-pegasus-product.png";
        String kennelUrl = "https://shop.example.com/catalog/pegasus-wooden-dog-kennel-platform.jpg";
        String nikeUrl = "https://static.nike.com/a/images/pegasus-41-running-shoe-product.png";
        String html = bingHtml(dogRampUrl, kennelUrl, nikeUrl);
        byte[] shoeBytes = shoeLikePngBytes();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(shoeBytes));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus", 12);

        assertTrue(results.contains(nikeUrl), "Expected the Nike Pegasus running-shoe candidate to remain. Results: " + results);
        assertFalse(results.contains(dogRampUrl), "Dog agility ramps are not shoe image candidates.");
        assertFalse(results.contains(kennelUrl), "Pet platforms/kennels are not shoe image candidates.");
    }

    @Test
    void shoeSearchRejectsJewelryAndAlbumArtForPegasusQueries() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String braceletUrl = "https://cdn.example.com/products/pegasus-turquoise-bracelet-product.jpg";
        String beadsUrl = "https://shop.example.com/catalog/pegasus-beaded-necklace-white-background.png";
        String albumUrl = "https://media.example.com/music/pegasus-live-concert-album-cover.jpg";
        String nikeUrl = "https://static.nike.com/a/images/pegasus-41-running-shoe-product.png";
        String html = bingHtml(braceletUrl, beadsUrl, albumUrl, nikeUrl);
        byte[] shoeBytes = shoeLikePngBytes();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(shoeBytes));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus", 12);

        assertTrue(results.contains(nikeUrl), "Expected the Nike Pegasus running-shoe candidate to remain. Results: " + results);
        assertFalse(results.contains(braceletUrl), "Bracelets are not shoe image candidates.");
        assertFalse(results.contains(beadsUrl), "Jewelry/beads are not shoe image candidates.");
        assertFalse(results.contains(albumUrl), "Album art is not a shoe image candidate.");
    }

    @Test
    void shoeSearchInfersBrandDomainFromCustomQueryWhenShoeBrandIsBlank() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String braceletUrl = "https://cdn.example.com/products/pegasus-bracelet-product.jpg";
        String nikeUrl = "https://static.nike.com/a/images/pegasus-41-running-shoe-product.png";
        String html = bingHtml(braceletUrl, nikeUrl);
        byte[] shoeBytes = shoeLikePngBytes();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(shoeBytes));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("", "", "Nike Pegasus", 12);

        assertTrue(results.contains(nikeUrl), "Expected Nike Pegasus custom search to infer the Nike domain.");
        assertFalse(results.contains(braceletUrl), "Typed shoe keywords should still reject non-shoe product types.");

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        List<String> decodedQueries = searchUrlCaptor.getAllValues().stream()
                .map(BingImageScraperTests::decodeUrl)
                .collect(Collectors.toList());
        assertTrue(
                decodedQueries.stream().anyMatch(url -> url.contains("Nike Pegasus site:nike.com")),
                "Custom keyword search should infer the official Nike domain."
        );
    }

    @Test
    void shoeSearchKeepsBrandModelMatchWhenImageByteFetchIsUnavailable() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String nikeUrl = "https://cdn.runningwarehouse.test/images/nike-pegasus-41-blue-product.jpg";
        String braceletUrl = "https://cdn.example.com/products/nike-pegasus-turquoise-bracelet-product.jpg";
        String html = bingHtml(braceletUrl, nikeUrl);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("image host blocked server fetch"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus", 12);

        assertTrue(results.contains(nikeUrl), "Brand/model image URLs should survive even when byte fetch is blocked.");
        assertFalse(results.contains(braceletUrl), "Blocked object types should still be rejected before byte fetch.");
    }

    @Test
    void nikeOfficialSearchProvidesProductImagesBeforeBingFallback() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String nikeUrl = "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/cee9579f-b87e-47b7-9533-e83c3bb9b848/AIR+ZOOM+PEGASUS+42+RR.png";
        String html = "<html><body>" + "x".repeat(128) + "<img src=\"" + nikeUrl + "\"></body></html>";

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("static nike image host blocks test fetch"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("", "", "Nike Pegasus", 12);

        assertTrue(results.contains(nikeUrl), "Nike official search page should provide usable Pegasus product images.");

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        assertTrue(
                searchUrlCaptor.getAllValues().stream().anyMatch(url -> url.contains("https://www.nike.com/w?q=pegasus")),
                "Nike official search should use the product term without repeating the brand."
        );
    }

    @Test
    void shoeSearchRejectsConflictingPegasusVersionFromOfficialNikeSearch() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String pegasus42Url = "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/cee9579f-b87e-47b7-9533-e83c3bb9b848/AIR+ZOOM+PEGASUS+42+RR.png";
        String pegasus41Url = "https://cdn.runningwarehouse.test/images/nike-pegasus-41-running-shoe-product.jpg";
        String html = "<html><body>" + "x".repeat(128)
                + "<img src=\"" + pegasus42Url + "\">"
                + "mediaurl=" + URLEncoder.encode(pegasus41Url, StandardCharsets.UTF_8)
                + "</body></html>";

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("image fetch not needed for high confidence metadata"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus 41", 12);

        assertTrue(results.contains(pegasus41Url), "Expected exact Pegasus 41 candidates to remain. Results: " + results);
        assertFalse(results.contains(pegasus42Url), "Pegasus 42 should not satisfy a Pegasus 41 keyword search.");

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        List<String> decodedQueries = searchUrlCaptor.getAllValues().stream()
                .map(BingImageScraperTests::decodeUrl)
                .collect(Collectors.toList());
        assertTrue(
                decodedQueries.stream().anyMatch(url -> url.contains("https://www.nike.com/w?q=pegasus 41")),
                "Nike official search should keep the typed model version instead of falling back to generic Pegasus."
        );
    }

    @Test
    void shoeSearchUsesBingResultMetadataForExactPegasusVersion() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String genericPegasusUrl = "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/abc/AIR+ZOOM+PEGASUS+RR.png";
        String pegasus40Url = "https://static.nike.com/a/images/t_web_pw_592_v2/f_auto/def/AIR+ZOOM+PEGASUS+40+RR.png";
        String opaquePegasus39Url = "https://cdn.farfetch.test/images/18716209_40812210_1000.jpg";
        String html = "<html><body>" + "x".repeat(128)
                + bingJsonImage(genericPegasusUrl, "Nike Pegasus Road Running Shoes", "https://www.nike.com/w/pegasus")
                + bingJsonImage(pegasus40Url, "Nike Air Zoom Pegasus 40 Road Running Shoes", "https://www.nike.com/t/air-zoom-pegasus-40")
                + bingJsonImage(opaquePegasus39Url, "Nike Air Zoom Pegasus 39 Women's Road Running Shoes", "https://www.farfetch.com/shopping/nike-air-zoom-pegasus-39")
                + "</body></html>";

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("image fetch not needed for high confidence metadata"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus 39", 12);

        assertTrue(results.contains(opaquePegasus39Url), "Opaque CDN URLs should survive when Bing metadata proves Pegasus 39.");
        assertFalse(results.contains(genericPegasusUrl), "Generic Pegasus metadata should not satisfy a numbered Pegasus 39 search.");
        assertFalse(results.contains(pegasus40Url), "Pegasus 40 metadata should not satisfy a Pegasus 39 search.");
    }

    @Test
    void shoeSearchParsesPlainEscapedBingJsonForExactPegasusVersion() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String opaquePegasus40Url = "https://cdn.example.test/images/18716209_40812210_1000.jpg";
        String html = "<html><body>" + "x".repeat(128)
                + "{\"t\":\"Nike Air Zoom Pegasus 40 Road Running Shoes\","
                + "\"murl\":\"" + opaquePegasus40Url.replace("/", "\\/") + "\","
                + "\"purl\":\"https:\\/\\/shop.example.test\\/nike-air-zoom-pegasus-40\"}"
                + "</body></html>";

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("image fetch not needed for high confidence metadata"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus 40", 12);

        assertTrue(results.contains(opaquePegasus40Url), "Plain escaped Bing murl JSON should keep exact Pegasus 40 metadata.");
    }

    @Test
    void bingImageSearchUrlMarksRealImagesEntryForm() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("<html><body>" + "x".repeat(128) + "</body></html>"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));
        scraper.scrapeMultipleImages("Nike Pegasus 41", 1);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        List<String> decoded = searchUrlCaptor.getAllValues().stream()
                .map(BingImageScraperTests::decodeUrl)
                .collect(Collectors.toList());
        assertTrue(
                decoded.stream().anyMatch(url -> url.contains("bing.com/images/search") && url.contains("form=HDRSC2")),
                "Bing image searches must carry form=HDRSC2 so Bing uses its real image index. URLs: " + decoded
        );
    }

    @Test
    void bingParserReadsJsonMurlImageCandidates() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        String nikeUrl = "https://static.nike.com/a/images/pegasus-41-running-shoe-product.jpg";
        String html = "<html><body>" + "x".repeat(128)
                + "&quot;murl&quot;:&quot;" + nikeUrl + "&quot;"
                + "</body></html>";

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenThrow(new RuntimeException("image fetch not needed for high confidence metadata"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("Nike", "Pegasus", "Nike Pegasus", 12);

        assertTrue(results.contains(nikeUrl), "Bing murl JSON candidates should be parsed as image URLs.");
    }

    @Test
    void chineseBrandRomanizedModelEmitsFeibiaoQueryFirst() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("<html><body>" + "x".repeat(128) + "</body></html>"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));
        scraper.searchShoeImageCandidates("361", "飞飚", "", 6);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        List<String> decoded = searchUrlCaptor.getAllValues().stream()
                .map(BingImageScraperTests::decodeUrl)
                .collect(Collectors.toList());

        assertTrue(
                decoded.stream().anyMatch(url -> url.contains("361 Feibiao") && url.contains("running shoe")),
                "A romanized '361 Feibiao running shoe' query must be part of the plan for the 飞飚 model. URLs: " + decoded
        );
        // The romanized query must come before the aggregate cap can crowd it out: assert it
        // appears within the first few requests.
        int romanizedIdx = -1;
        for (int i = 0; i < decoded.size(); i++) {
            if (decoded.get(i).contains("361 Feibiao")) { romanizedIdx = i; break; }
        }
        assertTrue(romanizedIdx >= 0 && romanizedIdx <= 4,
                "Romanized query should be among the highest-priority queries. idx=" + romanizedIdx + " URLs: " + decoded);
    }

    @Test
    void chineseBrandNameInputNormalizesToRomanizedBrandKey() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("<html><body>" + "x".repeat(128) + "</body></html>"));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));
        // User typed the brand in Chinese (李宁); the plan should still use the romanized brand.
        scraper.searchShoeImageCandidates("李宁", "赤兔", "", 6);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<String> searchUrlCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(restTemplate, atLeastOnce()).exchange(
                searchUrlCaptor.capture(),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
        List<String> decoded = searchUrlCaptor.getAllValues().stream()
                .map(BingImageScraperTests::decodeUrl)
                .collect(Collectors.toList());
        assertTrue(
                decoded.stream().anyMatch(url -> url.contains("Li-Ning Chitu") && url.contains("running shoe")),
                "Chinese brand name 李宁 must normalize to the romanized 'Li-Ning' brand in the query plan. URLs: " + decoded
        );
    }

    @Test
    void catalogShoePhotoPassesEvidenceGateWithoutBrandOrModelInUrl() throws Exception {
        // For brands/models whose names never appear in the image URL (e.g. 361 飞飚, where the
        // CDN URL is opaque), a real catalog running-shoe photo with white-background framing
        // should be admitted by the evidence gate rather than rejected as "no shoe metadata".
        RestTemplate restTemplate = mock(RestTemplate.class);
        // Opaque CDN URL (no brand/model text) but with strong running-shoe + product framing.
        String opaqueShoeUrl = "https://gw.alicdn.com/imgextra/i2/2210871026666/O1CN015NPqod1z7583Har2P_!!0-item_pic.jpg_640x640q90.jpg";
        String html = "<html><body>" + "x".repeat(128)
                + bingJsonImage(opaqueShoeUrl, "361 Feibiao future full palm carbon plate racing running shoes",
                        "https://www.chinaglobalmall.com/products/br5X06iGYX5GGwgcZg")
                + "</body></html>";
        byte[] shoeBytes = shoeLikePngBytes();

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(html));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(shoeBytes));

        BingImageScraper scraper = new BingImageScraper(restTemplate, SafeUrlExecutor.permissiveForTests(restTemplate));

        List<String> results = scraper.searchShoeImageCandidates("361", "飞飚", "", 6);

        assertTrue(results.contains(opaqueShoeUrl),
                "A catalog running-shoe photo whose URL is opaque should pass the evidence gate when its metadata "
                        + "carries strong running-shoe + product framing. Results: " + results);
    }


    private static String bingHtml(String... imageUrls) {
        String media = Stream.of(imageUrls)
                .map(url -> "mediaurl=" + URLEncoder.encode(url, StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        return "<html><body>" + "x".repeat(128) + media + "</body></html>";
    }

    private static String bingJsonImage(String imageUrl, String title, String pageUrl) {
        return "{&quot;t&quot;:&quot;" + title
                + "&quot;,&quot;murl&quot;:&quot;" + imageUrl
                + "&quot;,&quot;purl&quot;:&quot;" + pageUrl
                + "&quot;}";
    }

    private static String decodeUrl(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static byte[] shoeLikePngBytes() throws Exception {
        BufferedImage image = new BufferedImage(640, 360, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());

        g.setColor(new Color(42, 46, 55));
        Polygon upper = new Polygon(
                new int[]{112, 206, 390, 526, 568, 438, 220, 126},
                new int[]{216, 150, 142, 178, 226, 252, 250, 236},
                8
        );
        g.fillPolygon(upper);
        g.setColor(new Color(237, 94, 70));
        g.fillRoundRect(104, 224, 470, 42, 24, 24);
        g.setColor(new Color(246, 246, 246));
        g.fillOval(278, 176, 40, 22);
        g.fillOval(332, 172, 38, 20);
        g.dispose();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
