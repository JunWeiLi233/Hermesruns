package com.hermes.backend;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
public class RaceCourseMapImageService {
    private static final int MAX_IMAGE_BYTES = 6 * 1024 * 1024;
    private static final int MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
    private static final int MIN_IMAGE_DIMENSION_PX = 200;
    private static final int DEFAULT_PDF_RENDER_PAGE_LIMIT = 2;
    private static final int PDF_RENDER_DPI = 200;
    private static final int MAX_INLINE_UPLOAD_PREVIEW_DIMENSION_PX = 1800;
    private static final String LOCAL_COURSE_MAP_REFERENCE_PREFIX = "local-course-map:";

    private final RestTemplate restTemplate;

    @Value("${app.ai.course-map.pdf-render-page-limit:2}")
    private int pdfRenderPageLimit = DEFAULT_PDF_RENDER_PAGE_LIMIT;

    @Value("${app.course-map.upload-dir:course-map-images}")
    private String courseMapUploadDirectory = "course-map-images";

    public RaceCourseMapImageService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<RaceCourseMapService.ResolvedCandidateAsset> resolveCandidateAssets(RaceCourseMapService.CourseMapCandidate candidate) {
        if (candidate == null || candidate.imageUrl() == null || candidate.imageUrl().isBlank()) return List.of();
        if (isPdfFileUrl(candidate.imageUrl())) {
            byte[] pdfBytes = fetchDocumentBytes(candidate.imageUrl());
            if (pdfBytes == null) return List.of();
            return renderPdfCandidatePages(pdfBytes);
        }
        byte[] imageBytes = fetchImageBytes(candidate.imageUrl());
        if (imageBytes == null) return List.of();
        return List.of(new RaceCourseMapService.ResolvedCandidateAsset(candidate.imageUrl(), imageBytes));
    }

    public RaceCourseMapService.ResolvedCandidateAsset resolveUploadedReference(String imageReference) {
        if (imageReference == null || imageReference.isBlank()) return null;
        if (isLocalCourseMapReference(imageReference)) {
            byte[] imageBytes = readLocalCourseMapBytes(imageReference);
            if (imageBytes == null) return null;
            return new RaceCourseMapService.ResolvedCandidateAsset(imageReference, imageBytes);
        }
        if (isImageDataUrl(imageReference)) {
            byte[] imageBytes = decodeBase64DataUrlPayload(imageReference);
            if (imageBytes == null) return null;
            return normalizeInlineUploadPreview(imageReference, imageBytes, false);
        }
        if (isPdfDataUrl(imageReference)) {
            byte[] pdfBytes = decodeBase64DataUrlPayload(imageReference);
            if (pdfBytes == null) return null;
            return renderPdfCandidate(pdfBytes);
        }
        if (isPdfFileUrl(imageReference)) {
            byte[] pdfBytes = fetchDocumentBytes(imageReference);
            if (pdfBytes == null) return null;
            return renderPdfCandidate(pdfBytes);
        }
        byte[] imageBytes = fetchImageBytes(imageReference);
        if (imageBytes == null) return null;
        return new RaceCourseMapService.ResolvedCandidateAsset(imageReference, imageBytes);
    }

    public RaceCourseMapService.ResolvedCandidateAsset storeCourseMapUpload(String raceId, RaceCourseMapService.ResolvedCandidateAsset asset) {
        if (asset == null || asset.imageBytes() == null || asset.imageBytes().length == 0) return asset;
        try {
            Path uploadDirectory = resolveCourseMapUploadDirectory();
            Files.createDirectories(uploadDirectory);
            String mediaType = detectMediaTypeFromBytes(asset.imageBytes(), asset.imageUrl());
            String fileName = buildCourseMapFileName(raceId, asset.imageBytes(), mediaType);
            Path target = uploadDirectory.resolve(fileName).normalize();
            if (!target.startsWith(uploadDirectory)) {
                throw new IllegalArgumentException("Invalid course-map upload filename.");
            }
            Files.write(target, asset.imageBytes());
            return new RaceCourseMapService.ResolvedCandidateAsset(
                    LOCAL_COURSE_MAP_REFERENCE_PREFIX + fileName,
                    asset.imageBytes()
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to store course-map image locally.", exception);
        }
    }

    public String buildDisplayablePreviewImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return imageUrl;
        if (isImageDataUrl(imageUrl)) return imageUrl;
        RaceCourseMapService.ResolvedCandidateAsset resolved = resolveUploadedReference(imageUrl);
        if (resolved == null || resolved.imageBytes() == null || resolved.imageBytes().length == 0) return imageUrl;
        String mediaType = detectMediaTypeFromBytes(resolved.imageBytes(), imageUrl);
        if (mediaType == null || mediaType.isBlank()) mediaType = "image/png";
        return "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(resolved.imageBytes());
    }

    public String buildTransparentCourseMapOverlayImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return "";
        RaceCourseMapService.ResolvedCandidateAsset resolved = resolveUploadedReference(imageUrl);
        if (resolved == null || resolved.imageBytes() == null || resolved.imageBytes().length == 0) return "";
        BufferedImage decoded = decodeImage(resolved.imageBytes());
        if (decoded == null) return "";
        BufferedImage resized = resizePreviewIfNeeded(decoded);
        BufferedImage transparentOverlay = new BufferedImage(resized.getWidth(), resized.getHeight(), BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < resized.getHeight(); y++) {
            for (int x = 0; x < resized.getWidth(); x++) {
                int rgb = resized.getRGB(x, y);
                int red = (rgb >> 16) & 0xFF;
                int green = (rgb >> 8) & 0xFF;
                int blue = rgb & 0xFF;
                int alpha = courseMapOverlayAlpha(red, green, blue);
                transparentOverlay.setRGB(x, y, (alpha << 24) | (red << 16) | (green << 8) | blue);
            }
        }
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(transparentOverlay, "png", output);
            byte[] encodedBytes = output.toByteArray();
            if (encodedBytes.length == 0) return "";
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(encodedBytes);
        } catch (Exception ignored) {
            return "";
        }
    }

    public String detectMediaTypeFromBytes(byte[] bytes, String fallbackUrl) {
        if (bytes != null && bytes.length > 8) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50 && bytes[2] == (byte) 0x4E && bytes[3] == (byte) 0x47) return "image/png";
            if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) return "image/jpeg";
            if (bytes.length > 12
                    && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                    && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return "image/webp";
            if (bytes.length > 12
                    && bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p'
                    && bytes[8] == 'a' && bytes[9] == 'v' && bytes[10] == 'i' && bytes[11] == 'f') return "image/avif";
        }
        return detectMediaType(fallbackUrl);
    }

    public boolean isCandidateImageLargeEnough(byte[] imageBytes) {
        BufferedImage decoded = decodeImage(imageBytes);
        if (decoded != null) {
            return decoded.getWidth() >= MIN_IMAGE_DIMENSION_PX && decoded.getHeight() >= MIN_IMAGE_DIMENSION_PX;
        }
        return isLikelyModernRasterFormat(imageBytes);
    }

    public BufferedImage decodeImage(byte[] bytes) {
        if (bytes == null) return null;
        try {
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (Exception ignored) {
            return null;
        }
    }

    private byte[] fetchImageBytes(String imageUrl) {
        return fetchBinaryBytes(imageUrl, MAX_IMAGE_BYTES);
    }

    private byte[] fetchDocumentBytes(String documentUrl) {
        return fetchBinaryBytes(documentUrl, MAX_DOCUMENT_BYTES);
    }

    private byte[] readLocalCourseMapBytes(String imageReference) {
        try {
            Path path = resolveLocalCourseMapPath(imageReference);
            if (path == null || !Files.isRegularFile(path)) return null;
            long size = Files.size(path);
            if (size <= 0 || size > MAX_DOCUMENT_BYTES) return null;
            return Files.readAllBytes(path);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Path resolveLocalCourseMapPath(String imageReference) {
        if (!isLocalCourseMapReference(imageReference)) return null;
        String fileName = imageReference.substring(LOCAL_COURSE_MAP_REFERENCE_PREFIX.length()).trim();
        if (fileName.isBlank()
                || fileName.contains("/")
                || fileName.contains("\\")
                || fileName.contains("..")) return null;
        Path uploadDirectory = resolveCourseMapUploadDirectory();
        Path resolved = uploadDirectory.resolve(fileName).normalize();
        return resolved.startsWith(uploadDirectory) ? resolved : null;
    }

    private Path resolveCourseMapUploadDirectory() {
        return Path.of(courseMapUploadDirectory == null || courseMapUploadDirectory.isBlank()
                ? "course-map-images"
                : courseMapUploadDirectory).toAbsolutePath().normalize();
    }

    private byte[] fetchBinaryBytes(String url, int maxBytes) {
        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(buildBinaryHeaders()), byte[].class);
            byte[] body = response.getBody();
            if (body == null || body.length == 0 || body.length > maxBytes) return null;
            return body;
        } catch (Exception ignored) {
            return null;
        }
    }

    private HttpHeaders buildBinaryHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        return headers;
    }

    private boolean isPdfFileUrl(String url) {
        return url != null && url.toLowerCase(Locale.ROOT).contains(".pdf");
    }

    private boolean isLocalCourseMapReference(String url) {
        return url != null && url.regionMatches(true, 0, LOCAL_COURSE_MAP_REFERENCE_PREFIX, 0, LOCAL_COURSE_MAP_REFERENCE_PREFIX.length());
    }

    private boolean isImageDataUrl(String url) {
        return url != null && url.regionMatches(true, 0, "data:image/", 0, 11);
    }

    private boolean isPdfDataUrl(String url) {
        return url != null && url.regionMatches(true, 0, "data:application/pdf", 0, 20);
    }

    private RaceCourseMapService.ResolvedCandidateAsset renderPdfCandidate(byte[] pdfBytes) {
        List<RaceCourseMapService.ResolvedCandidateAsset> renderedPages = renderPdfCandidatePages(pdfBytes);
        return renderedPages.isEmpty() ? null : renderedPages.get(0);
    }

    private List<RaceCourseMapService.ResolvedCandidateAsset> renderPdfCandidatePages(byte[] pdfBytes) {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            if (document.getNumberOfPages() == 0) return List.of();
            PDFRenderer renderer = new PDFRenderer(document);
            List<RaceCourseMapService.ResolvedCandidateAsset> renderedPages = new ArrayList<>();
            int pageLimit = Math.max(1, pdfRenderPageLimit);
            for (int pageIndex = 0; pageIndex < Math.min(document.getNumberOfPages(), pageLimit); pageIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, PDF_RENDER_DPI, ImageType.RGB);
                if (image == null) continue;
                RaceCourseMapService.ResolvedCandidateAsset normalized = normalizeDecodedUploadPreview(image, true);
                if (normalized == null || normalized.imageBytes().length == 0) continue;
                renderedPages.add(normalized);
            }
            return renderedPages;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private byte[] decodeBase64DataUrlPayload(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) return null;
        int comma = dataUrl.indexOf(',');
        if (comma <= 0 || comma >= dataUrl.length() - 1) return null;
        try {
            return Base64.getMimeDecoder().decode(dataUrl.substring(comma + 1).trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private String detectMediaType(String imageUrl) {
        if (imageUrl != null && imageUrl.startsWith("data:image/")) {
            int separator = imageUrl.indexOf(';');
            int comma = imageUrl.indexOf(',');
            int end = separator > 0 ? separator : comma;
            if (end > "data:".length()) return imageUrl.substring("data:".length(), end);
        }
        String lower = imageUrl == null ? "" : imageUrl.toLowerCase(Locale.ROOT);
        if (lower.contains(".pdf")) return "application/pdf";
        if (lower.contains(".png")) return "image/png";
        if (lower.contains(".webp")) return "image/webp";
        if (lower.contains(".gif")) return "image/gif";
        if (lower.contains(".avif")) return "image/avif";
        return "image/jpeg";
    }

    private String buildCourseMapFileName(String raceId, byte[] imageBytes, String mediaType) {
        return sanitizeFileStem(raceId) + "-" + shortContentHash(imageBytes) + extensionForMediaType(mediaType);
    }

    private String sanitizeFileStem(String raceId) {
        String stem = raceId == null ? "" : raceId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]+", "-");
        stem = stem.replaceAll("(^[.-]+|[.-]+$)", "");
        if (stem.isBlank()) return "course-map";
        return stem.length() > 80 ? stem.substring(0, 80) : stem;
    }

    private String shortContentHash(byte[] imageBytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(imageBytes);
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < Math.min(8, digest.length); index++) {
                builder.append(String.format("%02x", digest[index]));
            }
            return builder.toString();
        } catch (Exception ignored) {
            return Long.toHexString(java.util.Arrays.hashCode(imageBytes));
        }
    }

    private String extensionForMediaType(String mediaType) {
        String normalized = mediaType == null ? "" : mediaType.toLowerCase(Locale.ROOT);
        if (normalized.contains("png")) return ".png";
        if (normalized.contains("webp")) return ".webp";
        if (normalized.contains("gif")) return ".gif";
        if (normalized.contains("avif")) return ".avif";
        if (normalized.contains("bmp")) return ".bmp";
        return ".jpg";
    }

    private RaceCourseMapService.ResolvedCandidateAsset normalizeInlineUploadPreview(String originalReference, byte[] imageBytes, boolean preferPng) {
        BufferedImage decoded = decodeImage(imageBytes);
        if (decoded == null) {
            return new RaceCourseMapService.ResolvedCandidateAsset(originalReference, imageBytes);
        }
        RaceCourseMapService.ResolvedCandidateAsset normalized = normalizeDecodedUploadPreview(decoded, preferPng);
        if (normalized == null || normalized.imageBytes().length == 0) {
            return new RaceCourseMapService.ResolvedCandidateAsset(originalReference, imageBytes);
        }
        return normalized;
    }

    private RaceCourseMapService.ResolvedCandidateAsset normalizeDecodedUploadPreview(BufferedImage source, boolean preferPng) {
        if (source == null) return null;
        BufferedImage resized = resizePreviewIfNeeded(source);
        boolean usePng = preferPng || resized.getColorModel().hasAlpha();
        String format = usePng ? "png" : "jpg";
        String mediaType = usePng ? "image/png" : "image/jpeg";
        BufferedImage outputImage = resized;
        if (!usePng && resized.getType() != BufferedImage.TYPE_INT_RGB) {
            BufferedImage rgb = new BufferedImage(resized.getWidth(), resized.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = rgb.createGraphics();
            graphics.drawImage(resized, 0, 0, null);
            graphics.dispose();
            outputImage = rgb;
        }
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(outputImage, format, output);
            byte[] encodedBytes = output.toByteArray();
            if (encodedBytes.length == 0) return null;
            return new RaceCourseMapService.ResolvedCandidateAsset(
                    "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(encodedBytes),
                    encodedBytes
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private BufferedImage resizePreviewIfNeeded(BufferedImage source) {
        int width = source.getWidth();
        int height = source.getHeight();
        int maxDimension = Math.max(width, height);
        if (maxDimension <= MAX_INLINE_UPLOAD_PREVIEW_DIMENSION_PX) {
            return source;
        }
        double scale = MAX_INLINE_UPLOAD_PREVIEW_DIMENSION_PX / (double) maxDimension;
        int scaledWidth = Math.max(1, (int) Math.round(width * scale));
        int scaledHeight = Math.max(1, (int) Math.round(height * scale));
        int imageType = source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage resized = new BufferedImage(scaledWidth, scaledHeight, imageType);
        Graphics2D graphics = resized.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        graphics.drawImage(source, 0, 0, scaledWidth, scaledHeight, null);
        graphics.dispose();
        return resized;
    }

    private int courseMapOverlayAlpha(int red, int green, int blue) {
        int max = Math.max(red, Math.max(green, blue));
        int min = Math.min(red, Math.min(green, blue));
        int chroma = max - min;
        boolean whiteOrPaleBase = max >= 218 && min >= 188;
        boolean neutralStreetGrid = max >= 176 && chroma <= 44;
        boolean waterOrMapFill = blue >= 140 && green >= 112 && red <= 150 && blue - red >= 34;
        if (whiteOrPaleBase || neutralStreetGrid || waterOrMapFill) return 0;
        if (max <= 92) return 196;
        if (chroma >= 68) return 218;
        if (max <= 148) return 132;
        return 54;
    }

    private boolean isLikelyModernRasterFormat(byte[] bytes) {
        if (bytes == null || bytes.length < 16) return false;
        boolean looksLikeWebp = bytes[0] == 'R'
                && bytes[1] == 'I'
                && bytes[2] == 'F'
                && bytes[3] == 'F'
                && bytes[8] == 'W'
                && bytes[9] == 'E'
                && bytes[10] == 'B'
                && bytes[11] == 'P';
        boolean looksLikeAvif = bytes[4] == 'f'
                && bytes[5] == 't'
                && bytes[6] == 'y'
                && bytes[7] == 'p'
                && bytes[8] == 'a'
                && bytes[9] == 'v'
                && bytes[10] == 'i'
                && bytes[11] == 'f';
        return (looksLikeWebp || looksLikeAvif) && bytes.length >= 1024;
    }
}
