package com.hermes.backend.admin;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

public final class AdminApiResponses {
    private AdminApiResponses() {
    }

    public static ResponseEntity<AdminApiError> error(HttpStatus status, String error, String code) {
        return ResponseEntity.status(status).body(new AdminApiError(error, code));
    }

    public static ResponseEntity<AdminApiError> error(HttpStatus status, String error, String code, Map<String, Object> details) {
        return ResponseEntity.status(status).body(new AdminApiError(error, code, details));
    }
}
