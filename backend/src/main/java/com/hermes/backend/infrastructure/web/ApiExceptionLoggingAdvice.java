package com.hermes.backend.infrastructure.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Logs unhandled API exceptions (5xx) without leaking details to clients.
 */
@RestControllerAdvice
public class ApiExceptionLoggingAdvice {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionLoggingAdvice.class);
    private static final Set<String> SERVER_PATH_PREFIXES = Set.of("/api", "/assets", "/actuator", "/error");

    private final SpaForwardingController spaForwardingController;

    public ApiExceptionLoggingAdvice(SpaForwardingController spaForwardingController) {
        this.spaForwardingController = spaForwardingController;
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<?> handleNoResourceFound(NoResourceFoundException ex, HttpServletRequest request) throws Exception {
        String ip = RequestIpResolver.clientIp(request);
        String method = request == null ? "" : request.getMethod();
        String uri = request == null ? "" : request.getRequestURI();
        log.warn("Missing resource ip={} method={} uri={}", ip, method, uri);
        if (isBrowserSpaRoute(request, uri)) {
            return spaForwardingController.forward(request);
        }
        if (uri.startsWith("/assets/")) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("Not found");
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Not found"));
    }

    /**
     * Malformed request bodies (bad JSON, wrong structure) are client errors.
     * Without this mapping they fell through to the generic 500 handler,
     * polluting 5xx logs during automated probing.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<?> handleUnreadableBody(HttpMessageNotReadableException ex, HttpServletRequest request) {
        String ip = RequestIpResolver.clientIp(request);
        String method = request == null ? "" : request.getMethod();
        String uri = request == null ? "" : request.getRequestURI();
        log.warn("Malformed request body ip={} method={} uri={}", ip, method, uri);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid request body."));
    }

    /** Requests whose params cannot be converted (e.g. non-numeric id) are client errors. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<?> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid request parameter."));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<?> handleMissingParam(MissingServletRequestParameterException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Missing required parameter."));
    }

    /** Wrong verb on an existing path is a 405, not a 500. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<?> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(Map.of("error", "Method not allowed."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handle(Exception ex, HttpServletRequest request) {
        String ip = RequestIpResolver.clientIp(request);
        String method = request == null ? "" : request.getMethod();
        String uri = request == null ? "" : request.getRequestURI();
        log.error("Unhandled API error ip={} method={} uri={}", ip, method, uri, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error"));
    }

    private boolean isBrowserSpaRoute(HttpServletRequest request, String uri) {
        if (request == null || !"GET".equalsIgnoreCase(request.getMethod())) return false;
        String accept = request.getHeader(HttpHeaders.ACCEPT);
        if (accept == null || !accept.contains(MediaType.TEXT_HTML_VALUE)) return false;

        String normalizedUri = uri == null || uri.isBlank() ? "/" : uri;
        for (String prefix : SERVER_PATH_PREFIXES) {
            if (normalizedUri.equals(prefix) || normalizedUri.startsWith(prefix + "/")) return false;
        }

        int lastSlash = normalizedUri.lastIndexOf('/');
        String lastSegment = normalizedUri.substring(lastSlash + 1);
        return !lastSegment.contains(".");
    }
}
