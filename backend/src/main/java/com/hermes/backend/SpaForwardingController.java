package com.hermes.backend;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

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
        "/", "/login", "/signup", "/admin", "/dashboard",
        "/profile", "/runs", "/run", "/run/{id}", "/analysis", "/shoes", "/races"
    }, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> forward() throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/static/index.html")) {
            if (in == null) {
                return ResponseEntity.notFound().build();
            }
            String html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .body(html);
        }
    }
}
