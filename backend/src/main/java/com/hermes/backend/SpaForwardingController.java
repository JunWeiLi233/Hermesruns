package com.hermes.backend;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SpaForwardingController {
    /**
     * Serve index.html for all frontend routes so React Router
     * can handle client-side routing.
     */
    @GetMapping(value = {
        "/",
        "/login",
        "/signup",
        "/terms",
        "/privacy",
        "/admin",
        "/dashboard",
        "/profile",
        "/runs",
        "/heatmap",
        "/run",
        "/run/{id}",
        "/analysis",
        "/analysis/{insightKey}",
        "/prediction/{distKey}",
        "/today-run",
        "/rewards",
        "/settings",
        "/shoes",
        "/shoes/add",
        "/add-shoes",
        "/shoe-catalog",
        "/races",
        "/races/details/{raceId}",
        "/schedule",
        "/muscle-training"
    }, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> forward() throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/static/index.html")) {
            if (in == null) {
                return ResponseEntity.notFound().build();
            }
            String html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .contentType(MediaType.TEXT_HTML)
                    .body(html);
        }
    }
}
