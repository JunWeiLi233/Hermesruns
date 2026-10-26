package com.hermes.backend.infrastructure.web;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Database readiness is separate from the lightweight /internal/health liveness probe. */
@RestController
public class ReadinessController {
    private final DataSource dataSource;

    public ReadinessController(DataSource dataSource) { this.dataSource = dataSource; }

    @GetMapping("/internal/ready")
    public ResponseEntity<Map<String, String>> ready() {
        boolean ready = false;
        try (Connection connection = dataSource.getConnection()) {
            ready = connection.isValid(2);
        } catch (SQLException ignored) {
            // Never expose connection strings or credentials through a public probe.
        }
        return ResponseEntity.status(ready ? 200 : 503).cacheControl(CacheControl.noStore())
                .body(Map.of("status", ready ? "UP" : "DOWN"));
    }
}
