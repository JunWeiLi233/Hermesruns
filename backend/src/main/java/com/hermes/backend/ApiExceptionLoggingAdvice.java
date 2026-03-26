package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Logs unhandled API exceptions (5xx) without leaking details to clients.
 */
@RestControllerAdvice
public class ApiExceptionLoggingAdvice {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionLoggingAdvice.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handle(Exception ex, HttpServletRequest request) {
        String ip = RequestIpResolver.clientIp(request);
        String method = request == null ? "" : request.getMethod();
        String uri = request == null ? "" : request.getRequestURI();
        log.error("Unhandled API error ip={} method={} uri={}", ip, method, uri, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Server error"));
    }
}

