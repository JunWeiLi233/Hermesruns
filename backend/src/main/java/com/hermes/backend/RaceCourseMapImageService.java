package com.hermes.backend;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
public class RaceCourseMapImageService {
    private static final int MAX_IMAGE_BYTES = 6 * 1024 * 1024;
    private static final int MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
    private static final int MIN_IMAGE_DIMENSION_PX = 200;
    private static final int PDF_RENDER_PAGE_LIMIT = 3;
    private static final int PDF_RENDER_DPI = 200;

    private final RestTemplate restTemplate;

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
        if (isImageDataUrl(imageReference)) {
            byte[] imageBytes = decodeBase64DataUrlPayload(imageReference);
            if (imageBytes == null) return null;
            return new RaceCourseMapService.ResolvedCandidateAsset(imageReference, imageBytes);
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

    public String buildDisplayablePreviewImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return imageUrl;
        if (isImageDataUrl(imageUrl)) return imageUrl;
        RaceCourseMapService.ResolvedCandidateAsset resolved = resolveUploadedReference(imageUrl);
        if (resolved == null || resolved.imageBytes() == null || resolved.imageBytes().length == 0) return imageUrl;
        String mediaType = detectMediaTypeFromBytes(resolved.imageBytes(), imageUrl);
        if (mediaType == null || mediaType.isBlank()) mediaType = "image/png";
        return "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(resolved.imageBytes());
    }

    public String detectMediaTypeFromBytes(byte[] bytes, String fallbackUrl) {
        if (bytes != null && bytes.length > 8) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50 && bytes[2] == (byte) 0x4E && bytes[3] == (byte) 0x47) return "image/png";
            if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) return "image/jpeg";
        }
        return detectMediaType(fallbackUrl);
    }

    public boolean isCandidateImageLargeEnough(byte[] imageBytes) {
        BufferedImage decoded = decodeImage(imageBytes);
        return decoded != null && decoded.getWidth() >= MIN_IMAGE_DIMENSION_PX && decoded.getHeight() >= MIN_IMAGE_DIMENSION_PX;
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
            for (int pageIndex = 0; pageIndex < Math.min(document.getNumberOfPages(), PDF_RENDER_PAGE_LIMIT); pageIndex++) {
                BufferedImage image = renderer.renderImageWithDPI(pageIndex, PDF_RENDER_DPI, ImageType.RGB);
                if (image == null) continue;
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                ImageIO.write(image, "png", output);
                byte[] imageBytes = output.toByteArray();
                if (imageBytes.length == 0) continue;
                renderedPages.add(new RaceCourseMapService.ResolvedCandidateAsset("data:image/png;base64," + Base64.getEncoder().encodeToString(imageBytes), imageBytes));
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
}
