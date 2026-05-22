package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserPortalController {
    private static final Set<String> USER_SORT_FIELDS = Set.of("id", "email", "role", "status", "subscriptionTier", "createdAt");
    private static final Set<String> NOTE_FIELDS = Set.of("noteText");
    private static final Set<String> BULK_USER_FIELDS = Set.of("ids", "action", "dryRun", "months");

    private final AdminPortalService adminService;

    public AdminUserPortalController(AdminPortalService adminService) {
        this.adminService = adminService;
    }

    @GetMapping
    public ResponseEntity<?> users(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String role,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String queue
    ) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");

        Pageable pageable = adminService.buildPageable(page, size, sortBy, sortDirection, USER_SORT_FIELDS);
        Page<Runner> result = adminService.getRunnerRepository().findAll(adminService.userFilterSpec(search, role, status, queue), pageable);
        Map<Long, Long> noteCounts = adminService.loadNoteCounts(result.getContent());
        Page<UserAdminDto> dtoPage = result.map(runner -> adminService.toUserDto(runner, noteCounts.getOrDefault(runner.getId(), 0L)));
        return ResponseEntity.ok(AdminPagedResponse.from(dtoPage, pageable.getSort()));
    }

    @GetMapping("/export")
    public ResponseEntity<?> exportUsers(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String role,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String queue
    ) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");

        List<Runner> users = adminService.getRunnerRepository().findAll(adminService.userFilterSpec(search, role, status, queue), Sort.by(Sort.Direction.DESC, "createdAt"));
        Map<Long, Long> noteCounts = adminService.loadNoteCounts(users);
        StringBuilder csv = new StringBuilder("id,email,role,status,subscriptionTier,emailVerified,createdAt,noteCount\n");
        for (Runner runner : users) {
            csv.append(adminService.csvCell(String.valueOf(runner.getId()))).append(',')
                    .append(adminService.csvCell(runner.getEmail())).append(',')
                    .append(adminService.csvCell(runner.getRole())).append(',')
                    .append(adminService.csvCell(runner.getStatus())).append(',')
                    .append(adminService.csvCell(runner.getSubscriptionTier())).append(',')
                    .append(adminService.csvCell(String.valueOf(runner.isEmailVerified()))).append(',')
                    .append(adminService.csvCell(runner.getCreatedAt() == null ? "" : runner.getCreatedAt().toString())).append(',')
                    .append(adminService.csvCell(String.valueOf(noteCounts.getOrDefault(runner.getId(), 0L))))
                    .append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=admin-users.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv.toString());
    }

    @GetMapping("/{id}/notes")
    public ResponseEntity<?> userNotes(@PathVariable Long id,
                                       @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        if (adminService.getRunnerRepository().findById(id).isEmpty()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Runner not found.", "runner_not_found");
        return ResponseEntity.ok(adminService.getRunnerAdminNoteRepository().findByRunnerIdOrderByCreatedAtDesc(id).stream().map(adminService::toNoteDto).toList());
    }

    @PostMapping("/{id}/notes")
    public ResponseEntity<?> addUserNote(@PathVariable Long id,
                                         @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<Runner> runnerOptional = adminService.getRunnerRepository().findById(id);
        if (runnerOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Runner not found.", "runner_not_found");

        final String noteText;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, NOTE_FIELDS);
            noteText = RequestBodyValidator.requiredSafeText(body, "noteText", 4000);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_note");
        }
        RunnerAdminNote note = new RunnerAdminNote();
        note.setRunner(runnerOptional.get());
        note.setAuthorRunnerId(adminOptional.get().getId());
        note.setAuthorEmail(adminOptional.get().getEmail());
        note.setNoteText(noteText);
        RunnerAdminNote saved = adminService.getRunnerAdminNoteRepository().save(note);
        adminService.getAdminAuditService().log(adminOptional.get(), "runner.note.added", "runner", String.valueOf(id), "Added support note", Map.of("noteId", saved.getId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.toNoteDto(saved));
    }

    @PostMapping("/{id}/impersonate")
    public ResponseEntity<?> impersonateUser(@PathVariable Long id,
                                             @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        Optional<Runner> targetOptional = adminService.getRunnerRepository().findById(id);
        if (targetOptional.isEmpty() || targetOptional.get().isDeleted()) return AdminApiResponses.error(HttpStatus.NOT_FOUND, "Runner not found.", "runner_not_found");

        Runner target = targetOptional.get();
        String token = adminService.getAuthService().issueSessionToken(target);
        adminService.getAdminAuditService().log(adminOptional.get(), "runner.impersonated", "runner", String.valueOf(target.getId()),
                "Started support impersonation", Map.of("targetEmail", target.getEmail()));
        return ResponseEntity.ok(Map.of("token", token, "email", target.getEmail(), "role", target.getRole()));
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> bulkUsers(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                       @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = adminService.requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, BULK_USER_FIELDS);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_bulk_request");
        }
        BulkSelection selection = adminService.parseSelection(body);
        if (selection.ids().isEmpty()) return AdminApiResponses.error(HttpStatus.BAD_REQUEST, "ids is required.", "missing_ids");

        final String action;
        final boolean dryRun;
        final int months;
        try {
            action = RequestBodyValidator.requiredSafeText(body, "action", 32);
            dryRun = RequestBodyValidator.booleanOrDefault(body, "dryRun", false);
            months = RequestBodyValidator.intOrDefault(body, "months", 1, 1, 24);
        } catch (IllegalArgumentException ex) {
            return AdminApiResponses.error(HttpStatus.BAD_REQUEST, ex.getMessage(), "invalid_bulk_request");
        }
        List<Runner> runners = adminService.getRunnerRepository().findAllById(selection.ids());
        int affected = 0;
        for (Runner runner : runners) {
            if ("soft_delete".equals(action) && !runner.isDeleted() && !Objects.equals(runner.getId(), adminOptional.get().getId())) affected++;
            if ("grant_pro".equals(action) || "revoke_pro".equals(action)) affected++;
        }
        if (dryRun) return ResponseEntity.ok(Map.of("dryRun", true, "action", action, "selected", selection.ids().size(), "affected", affected));

        for (Runner runner : runners) {
            switch (action) {
                case "soft_delete" -> {
                    if (Objects.equals(runner.getId(), adminOptional.get().getId()) || runner.isDeleted()) continue;
                    runner.setDeleted(true);
                    runner.setStatus("DELETED");
                    runner.setSessionToken(null);
                    adminService.getRunnerRepository().save(runner);
                    adminService.getAdminAuditService().log(adminOptional.get(), "runner.deleted", "runner", String.valueOf(runner.getId()), "Soft deleted runner");
                }
                case "grant_pro" -> {
                    adminService.getAiUsageService().grantPro(runner, Math.max(1, months));
                    adminService.getAdminAuditService().log(adminOptional.get(), "runner.subscription.granted", "runner", String.valueOf(runner.getId()),
                            "Granted Pro subscription", Map.of("months", Math.max(1, months)));
                }
                case "revoke_pro" -> {
                    adminService.getAiUsageService().revokePro(runner);
                    adminService.getAdminAuditService().log(adminOptional.get(), "runner.subscription.revoked", "runner", String.valueOf(runner.getId()),
                            "Revoked Pro subscription");
                }
                default -> {
                    return AdminApiResponses.error(HttpStatus.BAD_REQUEST, "Unsupported bulk action.", "unsupported_action");
                }
            }
        }
        return ResponseEntity.ok(Map.of("dryRun", false, "action", action, "selected", selection.ids().size(), "affected", affected));
    }
}
