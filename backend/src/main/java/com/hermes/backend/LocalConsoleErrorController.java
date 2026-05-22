package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/dev/console-errors")
public class LocalConsoleErrorController {
    private static final Set<String> BODY_FIELDS = Set.of("errors");

    private final LocalConsoleErrorService localConsoleErrorService;
    private final ObjectMapper objectMapper;

    public LocalConsoleErrorController(LocalConsoleErrorService localConsoleErrorService, ObjectMapper objectMapper) {
        this.localConsoleErrorService = localConsoleErrorService;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    public ResponseEntity<?> record(
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request
    ) {
        if (!isLocalDevRequest(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Local Hermes runtime only."));
        }

        try {
            RequestBodyValidator.requireBody(body);
            RequestBodyValidator.rejectUnexpectedFields(body, BODY_FIELDS);
            List<Map<String, Object>> errors = RequestBodyValidator.requireObjectList(body, "errors", 100);
            List<Map<String, Object>> recorded = new ArrayList<>();
            for (Map<String, Object> row : errors) {
                LocalConsoleErrorReport report = objectMapper.convertValue(row, LocalConsoleErrorReport.class);
                if (report.message() == null) {
                    throw new IllegalArgumentException("message is required.");
                }
                LocalConsoleErrorService.RecordResult result = localConsoleErrorService.record(report);
                recorded.add(Map.of(
                        "fingerprint", result.fingerprint(),
                        "count", result.count()
                ));
            }
            return ResponseEntity.ok(Map.of(
                    "recorded", true,
                    "count", recorded.size(),
                    "results", recorded
            ));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", error.getMessage()));
        }
    }

    static boolean isLocalDevRequest(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        boolean loopbackRemote = isLoopback(remoteAddr);

        String serverName = request.getServerName();
        boolean localServer = "localhost".equalsIgnoreCase(serverName)
                || "127.0.0.1".equals(serverName)
                || "::1".equals(serverName)
                || "0:0:0:0:0:0:0:1".equals(serverName);

        String hostHeader = request.getHeader("Host");
        boolean localHostHeader = hostHeader == null
                || hostHeader.equalsIgnoreCase("localhost:8080")
                || hostHeader.equalsIgnoreCase("127.0.0.1:8080")
                || hostHeader.equalsIgnoreCase("[::1]:8080");

        int port = request.getServerPort();
        boolean localPort = port == 8080 || port == 0;

        return loopbackRemote && localServer && localHostHeader && localPort;
    }

    private static boolean isLoopback(String host) {
        if (host == null || host.isBlank()) return false;
        try {
            return InetAddress.getByName(host).isLoopbackAddress();
        } catch (Exception ignored) {
            return false;
        }
    }
}
