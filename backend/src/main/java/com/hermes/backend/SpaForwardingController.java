package com.hermes.backend;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

@RestController
public class SpaForwardingController {

    /**
     * Single source of truth for every frontend (SPA) route that must serve index.html.
     * Immutable; derived from the {@link GetMapping} annotation below so the route list
     * can never drift between the controller mapping and SecurityConfig. Most routes are
     * public SPA entry points; protected admin routes are matched first by SecurityConfig.
     */
    public static final List<String> SPA_ROUTES = spaRoutePatterns();

    private static List<String> spaRoutePatterns() {
        List<String> patterns = Arrays.stream(SpaForwardingController.class.getDeclaredMethods())
                .map(method -> method.getAnnotation(GetMapping.class))
                .filter(Objects::nonNull)
                .flatMap(mapping -> Arrays.stream(mapping.value()))
                .distinct()
                .toList();
        if (patterns.isEmpty()) {
            throw new IllegalStateException("SpaForwardingController must declare at least one @GetMapping route.");
        }
        return patterns;
    }

    /**
     * Serve index.html for all frontend routes so React Router
     * can handle client-side routing.
     */
    @GetMapping(value = {
        "/",
        "/login",
        "/signup",
        "/forgot-password",
        "/terms",
        "/privacy",
        "/admin",
        "/admin/",
        "/dashboard",
        "/dashboard/{section:[^.]+}",
        "/dashboard/{section:[^.]+}/{detail:[^.]+}",
        "/profile",
        "/runs",
        "/heatmap",
        "/run",
        "/run/{id}",
        "/analysis",
        "/weather",
        "/weather-engine",
        "/analysis/{insightKey}",
        "/prediction/{distKey}",
        "/today-run",
        "/rewards",
        "/settings",
        "/settings/{section:[^.]+}",
        "/shoes",
        "/shoes/add",
        "/add-shoes",
        "/shoe-catalog",
        "/races",
        "/races/details/{raceId}",
        "/schedule",
        "/muscle-training",
        "/workflows"
    }, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> forward() throws IOException {
        Path localStaticIndex = Path.of("target", "classes", "static", "index.html");
        if (Files.isRegularFile(localStaticIndex)) {
            return htmlResponse(Files.readString(localStaticIndex, StandardCharsets.UTF_8));
        }

        try (InputStream in = getClass().getResourceAsStream("/static/index.html")) {
            if (in == null) {
                return ResponseEntity.notFound().build();
            }
            String html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            return htmlResponse(html);
        }
    }

    private ResponseEntity<String> htmlResponse(String html) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate")
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }
}
