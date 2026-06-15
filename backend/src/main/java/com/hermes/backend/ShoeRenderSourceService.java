package com.hermes.backend;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ShoeRenderSourceService {
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final long MAX_RENDER_SOURCE_BYTES = 8L * 1024L * 1024L;

    private final RestTemplate restTemplate;

    public ShoeRenderSourceService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public ResponseEntity<?> render(String url) {
        final String safeUrl;
        try {
            safeUrl = SafeUrlValidator.validateHttpUrlOrNull(url, MAX_PHOTO_REFERENCE_LENGTH, "url");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }
        if (safeUrl == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "url is required."));
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.ALL));
            headers.set("User-Agent", "Hermes/1.0");
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    safeUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );

            MediaType contentType = response.getHeaders().getContentType();
            byte[] body = response.getBody();
            if (contentType == null || !contentType.toString().toLowerCase(Locale.ROOT).startsWith("image/")) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Remote resource is not an image."));
            }
            if (body == null || body.length == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Remote image was empty."));
            }
            if (body.length > MAX_RENDER_SOURCE_BYTES) {
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "Remote image is too large."));
            }

            return ResponseEntity.ok()
                    .contentType(contentType)
                    .cacheControl(CacheControl.maxAge(Duration.ofHours(6)).cachePrivate())
                    .body(body);
        } catch (HttpStatusCodeException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not fetch remote image."));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not prepare remote image."));
        }
    }
}
