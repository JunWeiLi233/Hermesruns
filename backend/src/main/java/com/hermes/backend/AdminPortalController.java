package com.hermes.backend;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/admin")
public class AdminPortalController {
    private static final Set<String> USER_SORT_FIELDS = Set.of("id", "email", "role", "status", "subscriptionTier", "createdAt");
    private static final Set<String> SHOE_SORT_FIELDS = Set.of("id", "brand", "model", "createdAt");
    private static final Set<String> JOB_SORT_FIELDS = Set.of("id", "createdAt", "status", "jobType");
    private static final Set<String> AUDIT_SORT_FIELDS = Set.of("id", "createdAt", "action", "targetType");
    private static final Set<String> NOTE_FIELDS = Set.of("noteText");
    private static final Set<String> BULK_USER_FIELDS = Set.of("ids", "action", "dryRun", "months");
    private static final Set<String> BULK_SHOE_FIELDS = Set.of("ids", "action", "dryRun");
    private static final Set<String> FILTER_FIELDS = Set.of("scope", "name", "queryJson");

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final ShoeRepository shoeRepository;
    private final RunnerAdminNoteRepository runnerAdminNoteRepository;
    private final AdminSavedFilterRepository adminSavedFilterRepository;
    private final AdminAuditLogRepository adminAuditLogRepository;
    private final AdminBackgroundJobRepository adminBackgroundJobRepository;
    private final AdminAuditService adminAuditService;
    private final AiUsageService aiUsageService;
    private final StravaAutoSyncScheduler stravaAutoSyncScheduler;

    public AdminPortalController(
            AuthService authService,
            RunnerRepository runnerRepository,
            ShoeRepository shoeRepository,
            RunnerAdminNoteRepository runnerAdminNoteRepository,
            AdminSavedFilterRepository adminSavedFilterRepository,
            AdminAuditLogRepository adminAuditLogRepository,
            AdminBackgroundJobRepository adminBackgroundJobRepository,
            AdminAuditService adminAuditService,
            AiUsageService aiUsageService,
            StravaAutoSyncScheduler stravaAutoSyncScheduler
    ) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.shoeRepository = shoeRepository;
        this.runnerAdminNoteRepository = runnerAdminNoteRepository;
        this.adminSavedFilterRepository = adminSavedFilterRepository;
        this.adminAuditLogRepository = adminAuditLogRepository;
        this.adminBackgroundJobRepository = adminBackgroundJobRepository;
        this.adminAuditService = adminAuditService;
        this.aiUsageService = aiUsageService;
        this.stravaAutoSyncScheduler = stravaAutoSyncScheduler;
    }

    @GetMapping("/overview")
    public ResponseEntity<?> overview(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("kpis", List.of(
                kpi("Active users", runnerRepository.countByDeletedFalse(), dailyUserTrend(7)),
                kpi("Shoes", shoeRepository.count(), dailyShoeTrend(7)),
                kpi("Missing shoe images", shoeRepository.count(shoeFilterSpec("", "missing_photo", false)), List.of()),
                kpi("Unverified shoe photos", shoeRepository.count(shoeFilterSpec("", "unverified_photo", false)), List.of()),
                kpi("Recent signup issues", runnerRepository.count(userFilterSpec("", "", "", "recent_signup_issues")), List.of()),
                kpi("Billing exceptions", runnerRepository.count(userFilterSpec("", "", "", "billing_exceptions")), List.of()),
                kpi("Failed sync jobs", adminBackgroundJobRepository.findTop10ByStatusInOrderByCreatedAtDesc(
                        List.of(AdminBackgroundJob.STATUS_FAILED)).size(), List.of())
        ));
        response.put("queues", queueSummaryBody());
        response.put("recentJobs", adminBackgroundJobRepository.findTop10ByStatusInOrderByCreatedAtDesc(
                List.of(AdminBackgroundJob.STATUS_RUNNING, AdminBackgroundJob.STATUS_FAILED, AdminBackgroundJob.STATUS_COMPLETED))
                .stream()
                .map(this::toJobDto)
                .toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/users")
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
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();

        Pageable pageable = buildPageable(page, size, sortBy, sortDirection, USER_SORT_FIELDS);
        Page<Runner> result = runnerRepository.findAll(userFilterSpec(search, role, status, queue), pageable);
        Map<Long, Long> noteCounts = loadNoteCounts(result.getContent());
        Page<UserAdminDto> dtoPage = result.map(runner -> toUserDto(runner, noteCounts.getOrDefault(runner.getId(), 0L)));
        return ResponseEntity.ok(AdminPagedResponse.from(dtoPage, pageable.getSort()));
    }

    @GetMapping("/users/export")
    public ResponseEntity<?> exportUsers(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String role,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String queue
    ) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();

        List<Runner> users = runnerRepository.findAll(userFilterSpec(search, role, status, queue), Sort.by(Sort.Direction.DESC, "createdAt"));
        Map<Long, Long> noteCounts = loadNoteCounts(users);
        StringBuilder csv = new StringBuilder("id,email,role,status,subscriptionTier,emailVerified,createdAt,noteCount\n");
        for (Runner runner : users) {
            csv.append(csvCell(String.valueOf(runner.getId()))).append(',')
                    .append(csvCell(runner.getEmail())).append(',')
                    .append(csvCell(runner.getRole())).append(',')
                    .append(csvCell(runner.getStatus())).append(',')
                    .append(csvCell(runner.getSubscriptionTier())).append(',')
                    .append(csvCell(String.valueOf(runner.isEmailVerified()))).append(',')
                    .append(csvCell(runner.getCreatedAt() == null ? "" : runner.getCreatedAt().toString())).append(',')
                    .append(csvCell(String.valueOf(noteCounts.getOrDefault(runner.getId(), 0L))))
                    .append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=admin-users.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv.toString());
    }

    @GetMapping("/users/{id}/notes")
    public ResponseEntity<?> userNotes(@PathVariable Long id,
                                       @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        if (runnerRepository.findById(id).isEmpty()) return notFound("Runner not found.", "runner_not_found");
        return ResponseEntity.ok(runnerAdminNoteRepository.findByRunnerIdOrderByCreatedAtDesc(id).stream().map(this::toNoteDto).toList());
    }

    @PostMapping("/users/{id}/notes")
    public ResponseEntity<?> addUserNote(@PathVariable Long id,
                                         @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        Optional<Runner> runnerOptional = runnerRepository.findById(id);
        if (runnerOptional.isEmpty()) return notFound("Runner not found.", "runner_not_found");

        final String noteText;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, NOTE_FIELDS);
            noteText = RequestBodyValidator.requiredSafeText(body, "noteText", 4000);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "invalid_note");
        }
        RunnerAdminNote note = new RunnerAdminNote();
        note.setRunner(runnerOptional.get());
        note.setAuthorRunnerId(adminOptional.get().getId());
        note.setAuthorEmail(adminOptional.get().getEmail());
        note.setNoteText(noteText);
        RunnerAdminNote saved = runnerAdminNoteRepository.save(note);
        adminAuditService.log(adminOptional.get(), "runner.note.added", "runner", String.valueOf(id), "Added support note", Map.of("noteId", saved.getId()));
        return ResponseEntity.status(HttpStatus.CREATED).body(toNoteDto(saved));
    }

    @PostMapping("/users/{id}/impersonate")
    public ResponseEntity<?> impersonateUser(@PathVariable Long id,
                                             @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        Optional<Runner> targetOptional = runnerRepository.findById(id);
        if (targetOptional.isEmpty() || targetOptional.get().isDeleted()) return notFound("Runner not found.", "runner_not_found");

        Runner target = targetOptional.get();
        String token = authService.issueSessionToken(target);
        adminAuditService.log(adminOptional.get(), "runner.impersonated", "runner", String.valueOf(target.getId()),
                "Started support impersonation", Map.of("targetEmail", target.getEmail()));
        return ResponseEntity.ok(Map.of("token", token, "email", target.getEmail(), "role", target.getRole()));
    }

    @PostMapping("/users/bulk")
    public ResponseEntity<?> bulkUsers(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                       @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, BULK_USER_FIELDS);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "invalid_bulk_request");
        }
        BulkSelection selection = parseSelection(body);
        if (selection.ids().isEmpty()) return badRequest("ids is required.", "missing_ids");

        final String action;
        final boolean dryRun;
        final int months;
        try {
            action = RequestBodyValidator.requiredSafeText(body, "action", 32);
            dryRun = RequestBodyValidator.booleanOrDefault(body, "dryRun", false);
            months = RequestBodyValidator.intOrDefault(body, "months", 1, 1, 24);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "invalid_bulk_request");
        }
        List<Runner> runners = runnerRepository.findAllById(selection.ids());
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
                    runnerRepository.save(runner);
                    adminAuditService.log(adminOptional.get(), "runner.deleted", "runner", String.valueOf(runner.getId()), "Soft deleted runner");
                }
                case "grant_pro" -> {
                    aiUsageService.grantPro(runner, Math.max(1, months));
                    adminAuditService.log(adminOptional.get(), "runner.subscription.granted", "runner", String.valueOf(runner.getId()),
                            "Granted Pro subscription", Map.of("months", Math.max(1, months)));
                }
                case "revoke_pro" -> {
                    aiUsageService.revokePro(runner);
                    adminAuditService.log(adminOptional.get(), "runner.subscription.revoked", "runner", String.valueOf(runner.getId()),
                            "Revoked Pro subscription");
                }
                default -> {
                    return badRequest("Unsupported bulk action.", "unsupported_action");
                }
            }
        }
        return ResponseEntity.ok(Map.of("dryRun", false, "action", action, "selected", selection.ids().size(), "affected", affected));
    }

    @GetMapping("/shoes")
    public ResponseEntity<?> shoes(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String queue,
            @RequestParam(defaultValue = "false") boolean includeRetired
    ) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        Pageable pageable = buildPageable(page, size, sortBy, sortDirection, SHOE_SORT_FIELDS);
        Page<Shoe> result = shoeRepository.findAll(shoeFilterSpec(search, queue, includeRetired), pageable);
        return ResponseEntity.ok(AdminPagedResponse.from(result.map(this::toShoeDto), pageable.getSort()));
    }

    @GetMapping("/shoes/export")
    public ResponseEntity<?> exportShoes(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                         @RequestParam(defaultValue = "") String search,
                                         @RequestParam(defaultValue = "") String queue,
                                         @RequestParam(defaultValue = "false") boolean includeRetired) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();

        List<Shoe> shoes = shoeRepository.findAll(shoeFilterSpec(search, queue, includeRetired), Sort.by(Sort.Direction.DESC, "createdAt"));
        StringBuilder csv = new StringBuilder("id,brand,model,nickname,runnerEmail,photoVerified,retired,createdAt\n");
        for (Shoe shoe : shoes) {
            csv.append(csvCell(String.valueOf(shoe.getId()))).append(',')
                    .append(csvCell(shoe.getBrand())).append(',')
                    .append(csvCell(shoe.getModel())).append(',')
                    .append(csvCell(shoe.getNickname())).append(',')
                    .append(csvCell(shoe.getRunner() == null ? "" : shoe.getRunner().getEmail())).append(',')
                    .append(csvCell(String.valueOf(shoe.isPhotoVerified()))).append(',')
                    .append(csvCell(String.valueOf(shoe.isRetired()))).append(',')
                    .append(csvCell(shoe.getCreatedAt() == null ? "" : shoe.getCreatedAt().toString()))
                    .append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=admin-shoes.csv")
                .contentType(MediaType.TEXT_PLAIN)
                .body(csv.toString());
    }

    @PostMapping("/shoes/bulk")
    public ResponseEntity<?> bulkShoes(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                       @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, BULK_SHOE_FIELDS);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "invalid_bulk_request");
        }
        BulkSelection selection = parseSelection(body);
        if (selection.ids().isEmpty()) return badRequest("ids is required.", "missing_ids");

        final String action;
        final boolean dryRun;
        try {
            action = RequestBodyValidator.requiredSafeText(body, "action", 32);
            dryRun = RequestBodyValidator.booleanOrDefault(body, "dryRun", false);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "invalid_bulk_request");
        }
        List<Shoe> shoes = shoeRepository.findAllById(selection.ids());
        int affected = (int) shoes.stream().filter(shoe -> isShoeBulkActionApplicable(shoe, action)).count();
        if (dryRun) return ResponseEntity.ok(Map.of("dryRun", true, "action", action, "selected", selection.ids().size(), "affected", affected));

        for (Shoe shoe : shoes) {
            if (!isShoeBulkActionApplicable(shoe, action)) continue;
            switch (action) {
                case "verify_photo" -> shoe.setPhotoVerified(true);
                case "unverify_photo" -> shoe.setPhotoVerified(false);
                case "clear_photo" -> {
                    shoe.setPhotoUrl(null);
                    shoe.setPhotoVerified(false);
                }
                default -> {
                    return badRequest("Unsupported bulk action.", "unsupported_action");
                }
            }
            shoeRepository.save(shoe);
            adminAuditService.log(adminOptional.get(), "shoe.bulk." + action, "shoe", String.valueOf(shoe.getId()),
                    "Applied bulk action to shoe", Map.of("brand", shoe.getBrand(), "model", shoe.getModel()));
        }
        return ResponseEntity.ok(Map.of("dryRun", false, "action", action, "selected", selection.ids().size(), "affected", affected));
    }

    @GetMapping("/queues")
    public ResponseEntity<?> queues(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        return ResponseEntity.ok(queueSummaryBody());
    }

    @GetMapping("/jobs")
    public ResponseEntity<?> jobs(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size,
                                  @RequestParam(defaultValue = "createdAt") String sortBy,
                                  @RequestParam(defaultValue = "desc") String sortDirection,
                                  @RequestParam(defaultValue = "") String jobType,
                                  @RequestParam(defaultValue = "") String status) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        Pageable pageable = buildPageable(page, size, sortBy, sortDirection, JOB_SORT_FIELDS);
        Page<AdminBackgroundJob> result = adminBackgroundJobRepository.findByJobTypeContainingIgnoreCaseAndStatusContainingIgnoreCase(
                jobType == null ? "" : jobType,
                status == null ? "" : status,
                pageable
        );
        return ResponseEntity.ok(AdminPagedResponse.from(result.map(this::toJobDto), pageable.getSort()));
    }

    @PostMapping("/jobs/strava-sync")
    public ResponseEntity<?> triggerStravaSync(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        AdminBackgroundJob job = stravaAutoSyncScheduler.triggerAdminSync(adminOptional.get(), "admin_manual");
        adminAuditService.log(adminOptional.get(), "job.strava_sync.triggered", "job", String.valueOf(job.getId()), "Triggered global Strava sync");
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(toJobDto(job));
    }

    @GetMapping("/audit")
    public ResponseEntity<?> audit(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size,
                                   @RequestParam(defaultValue = "createdAt") String sortBy,
                                   @RequestParam(defaultValue = "desc") String sortDirection,
                                   @RequestParam(defaultValue = "") String search) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        Pageable pageable = buildPageable(page, size, sortBy, sortDirection, AUDIT_SORT_FIELDS);
        Page<AdminAuditLog> result = (search == null || search.isBlank())
                ? adminAuditLogRepository.findAll(pageable)
                : adminAuditLogRepository.findByActionContainingIgnoreCaseOrTargetTypeContainingIgnoreCaseOrActorEmailContainingIgnoreCase(
                search.trim(), search.trim(), search.trim(), pageable);
        return ResponseEntity.ok(AdminPagedResponse.from(result.map(this::toAuditDto), pageable.getSort()));
    }

    @GetMapping("/filters")
    public ResponseEntity<?> filters(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                     @RequestParam(defaultValue = "users") String scope) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        return ResponseEntity.ok(adminSavedFilterRepository.findByOwnerRunnerIdAndScopeOrderByUpdatedAtDesc(adminOptional.get().getId(), scope)
                .stream().map(this::toSavedFilterDto).toList());
    }

    @PostMapping("/filters")
    public ResponseEntity<?> saveFilter(@RequestHeader(value = "Authorization", required = false) String authorizationHeader,
                                        @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        final String scope;
        final String name;
        final String queryJson;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, FILTER_FIELDS);
            scope = RequestBodyValidator.requiredSafeText(body, "scope", 50);
            name = RequestBodyValidator.requiredSafeText(body, "name", 120);
            queryJson = RequestBodyValidator.requiredString(body, "queryJson", 8000);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "invalid_saved_filter");
        }
        AdminSavedFilter filter = new AdminSavedFilter();
        filter.setOwnerRunnerId(adminOptional.get().getId());
        filter.setOwnerEmail(adminOptional.get().getEmail());
        filter.setScope(scope);
        filter.setName(name);
        filter.setQueryJson(queryJson);
        AdminSavedFilter saved = adminSavedFilterRepository.save(filter);
        adminAuditService.log(adminOptional.get(), "filter.saved", "saved_filter", String.valueOf(saved.getId()), "Saved admin filter", Map.of("scope", scope));
        return ResponseEntity.status(HttpStatus.CREATED).body(toSavedFilterDto(saved));
    }

    @DeleteMapping("/filters/{id}")
    public ResponseEntity<?> deleteFilter(@PathVariable Long id,
                                          @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> adminOptional = requireAdmin(authorizationHeader);
        if (adminOptional.isEmpty()) return forbidden();
        Optional<AdminSavedFilter> filterOptional = adminSavedFilterRepository.findById(id);
        if (filterOptional.isEmpty() || !Objects.equals(filterOptional.get().getOwnerRunnerId(), adminOptional.get().getId())) {
            return notFound("Saved filter not found.", "saved_filter_not_found");
        }
        adminSavedFilterRepository.delete(filterOptional.get());
        adminAuditService.log(adminOptional.get(), "filter.deleted", "saved_filter", String.valueOf(id), "Deleted admin filter");
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    private Specification<Runner> userFilterSpec(String search, String role, String status, String queue) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("displayName"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("subscriptionTier"), "")), like)
                ));
            }
            if (role != null && !role.isBlank()) predicates.add(cb.equal(cb.upper(root.get("role")), role.trim().toUpperCase()));
            if (status != null && !status.isBlank()) predicates.add(cb.equal(cb.upper(cb.coalesce(root.get("status"), "")), status.trim().toUpperCase()));
            if ("recent_signup_issues".equals(queue)) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), LocalDateTime.now().minusDays(14)));
                predicates.add(cb.isFalse(root.get("emailVerified")));
            }
            if ("billing_exceptions".equals(queue)) {
                predicates.add(cb.or(
                        cb.and(
                                cb.equal(cb.upper(cb.coalesce(root.get("subscriptionTier"), "FREE")), "PRO"),
                                cb.or(cb.isNull(root.get("proExpiresAt")), cb.lessThan(root.get("proExpiresAt"), LocalDateTime.now()))
                        ),
                        cb.and(
                                cb.notEqual(cb.upper(cb.coalesce(root.get("subscriptionTier"), "FREE")), "PRO"),
                                cb.isNotNull(root.get("proExpiresAt"))
                        )
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<Shoe> shoeFilterSpec(String search, String queue, boolean includeRetired) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (!includeRetired) predicates.add(cb.isFalse(root.get("retired")));
            Join<Shoe, Runner> runnerJoin = root.join("runner", JoinType.LEFT);
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(cb.coalesce(root.get("brand"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("model"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("nickname"), "")), like),
                        cb.like(cb.lower(cb.coalesce(runnerJoin.get("email"), "")), like)
                ));
            }
            if ("missing_photo".equals(queue)) {
                predicates.add(cb.or(cb.isNull(root.get("photoUrl")), cb.equal(cb.coalesce(root.get("photoUrl"), ""), "")));
            }
            if ("unverified_photo".equals(queue)) {
                predicates.add(cb.and(cb.isNotNull(root.get("photoUrl")), cb.isFalse(root.get("photoVerified"))));
            }
            if ("verified_photo".equals(queue)) {
                predicates.add(cb.and(cb.isNotNull(root.get("photoUrl")), cb.isTrue(root.get("photoVerified"))));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Map<Long, Long> loadNoteCounts(List<Runner> runners) {
        if (runners.isEmpty()) return Map.of();
        Map<Long, Long> counts = new HashMap<>();
        List<Long> runnerIds = runners.stream().map(Runner::getId).toList();
        for (Object[] row : runnerAdminNoteRepository.countGroupedByRunnerIds(runnerIds)) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private Map<String, Object> queueSummaryBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unverifiedShoePhotos", shoeRepository.findAll(shoeFilterSpec("", "unverified_photo", false), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(this::toShoeDto).getContent());
        body.put("missingShoeImages", shoeRepository.findAll(shoeFilterSpec("", "missing_photo", false), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(this::toShoeDto).getContent());
        body.put("recentSignupIssues", runnerRepository.findAll(userFilterSpec("", "", "", "recent_signup_issues"), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(r -> toUserDto(r, 0)).getContent());
        body.put("billingExceptions", runnerRepository.findAll(userFilterSpec("", "", "", "billing_exceptions"), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(r -> toUserDto(r, 0)).getContent());
        body.put("failedSyncs", adminBackgroundJobRepository.findTop10ByStatusInOrderByCreatedAtDesc(List.of(AdminBackgroundJob.STATUS_FAILED)).stream().map(this::toJobDto).limit(8).toList());
        return body;
    }

    private List<Map<String, Object>> dailyUserTrend(int days) {
        List<Runner> users = runnerRepository.findAll();
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            long count = users.stream().filter(r -> !r.isDeleted() && r.getCreatedAt() != null && date.equals(r.getCreatedAt().toLocalDate())).count();
            out.add(Map.of("label", date.toString(), "value", count));
        }
        return out;
    }

    private List<Map<String, Object>> dailyShoeTrend(int days) {
        List<Shoe> shoes = shoeRepository.findAll();
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            long count = shoes.stream().filter(s -> s.getCreatedAt() != null && date.equals(s.getCreatedAt().toLocalDate())).count();
            out.add(Map.of("label", date.toString(), "value", count));
        }
        return out;
    }

    private UserAdminDto toUserDto(Runner runner, long noteCount) {
        return new UserAdminDto(
                runner.getId(),
                runner.getEmail(),
                runner.getDisplayName(),
                runner.getRole(),
                runner.getStatus(),
                runner.getSubscriptionTier(),
                runner.getProExpiresAt() == null ? null : runner.getProExpiresAt().toString(),
                runner.isEmailVerified(),
                runner.getCreatedAt() == null ? null : runner.getCreatedAt().toString(),
                runner.getStravaAthleteId() != null,
                noteCount
        );
    }

    private ShoeAdminDto toShoeDto(Shoe shoe) {
        return new ShoeAdminDto(
                shoe.getId(),
                shoe.getBrand(),
                shoe.getModel(),
                shoe.getNickname(),
                shoe.getIdentityKey(),
                shoe.getPhotoUrl(),
                shoe.isPhotoVerified(),
                shoe.isRetired(),
                shoe.getCreatedAt() == null ? null : shoe.getCreatedAt().toString(),
                shoe.getRunner() == null ? null : shoe.getRunner().getId(),
                shoe.getRunner() == null ? null : shoe.getRunner().getEmail()
        );
    }

    private NoteDto toNoteDto(RunnerAdminNote note) {
        return new NoteDto(note.getId(), note.getAuthorRunnerId(), note.getAuthorEmail(), note.getCreatedAt().toString(), note.getNoteText());
    }

    private JobDto toJobDto(AdminBackgroundJob job) {
        return new JobDto(
                job.getId(),
                job.getJobType(),
                job.getTriggerSource(),
                job.getStatus(),
                job.getSummary(),
                job.getCreatedAt() == null ? null : job.getCreatedAt().toString(),
                job.getStartedAt() == null ? null : job.getStartedAt().toString(),
                job.getFinishedAt() == null ? null : job.getFinishedAt().toString(),
                job.getCreatedByEmail(),
                job.getTotalCount(),
                job.getSuccessCount(),
                job.getFailureCount(),
                job.getDetailsJson()
        );
    }

    private AuditDto toAuditDto(AdminAuditLog log) {
        return new AuditDto(
                log.getId(),
                log.getCreatedAt() == null ? null : log.getCreatedAt().toString(),
                log.getActorEmail(),
                log.getActorRole(),
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getSummary(),
                log.getMetadataJson()
        );
    }

    private SavedFilterDto toSavedFilterDto(AdminSavedFilter filter) {
        return new SavedFilterDto(
                filter.getId(),
                filter.getScope(),
                filter.getName(),
                filter.getQueryJson(),
                filter.getUpdatedAt() == null ? null : filter.getUpdatedAt().toString()
        );
    }

    private Map<String, Object> kpi(String label, long value, List<Map<String, Object>> trend) {
        return Map.of("label", label, "value", value, "trend", trend);
    }

    private Pageable buildPageable(int page, int size, String sortBy, String sortDirection, Set<String> allowedFields) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        String property = allowedFields.contains(sortBy) ? sortBy : "id";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(safePage, safeSize, Sort.by(direction, property));
    }

    private Optional<Runner> requireAdmin(String authorizationHeader) {
        return authService.findByAuthorizationHeader(authorizationHeader).filter(authService::isAdmin);
    }

    private ResponseEntity<AdminApiError> forbidden() {
        return AdminApiResponses.error(HttpStatus.FORBIDDEN, "Admin privileges required.", "admin_required");
    }

    private ResponseEntity<AdminApiError> badRequest(String error, String code) {
        return AdminApiResponses.error(HttpStatus.BAD_REQUEST, error, code);
    }

    private ResponseEntity<AdminApiError> notFound(String error, String code) {
        return AdminApiResponses.error(HttpStatus.NOT_FOUND, error, code);
    }

    private BulkSelection parseSelection(Map<String, Object> body) {
        Object idsRaw = body == null ? null : body.get("ids");
        if (!(idsRaw instanceof List<?> rawIds)) return new BulkSelection(List.of());
        List<Long> ids = rawIds.stream().filter(Number.class::isInstance).map(Number.class::cast).map(Number::longValue).distinct().toList();
        return new BulkSelection(ids);
    }

    private boolean isShoeBulkActionApplicable(Shoe shoe, String action) {
        return switch (action) {
            case "verify_photo" -> shoe.getPhotoUrl() != null && !shoe.getPhotoUrl().isBlank() && !shoe.isPhotoVerified();
            case "unverify_photo" -> shoe.getPhotoUrl() != null && !shoe.getPhotoUrl().isBlank() && shoe.isPhotoVerified();
            case "clear_photo" -> shoe.getPhotoUrl() != null && !shoe.getPhotoUrl().isBlank();
            default -> false;
        };
    }

    private String csvCell(String value) {
        String safe = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + safe + "\"";
    }

    private record BulkSelection(List<Long> ids) {
    }

    public record UserAdminDto(
            Long id,
            String email,
            String displayName,
            String role,
            String status,
            String subscriptionTier,
            String proExpiresAt,
            boolean emailVerified,
            String createdAt,
            boolean stravaLinked,
            long noteCount
    ) {
    }

    public record ShoeAdminDto(
            Long id,
            String brand,
            String model,
            String nickname,
            String identityKey,
            String photoUrl,
            boolean photoVerified,
            boolean retired,
            String createdAt,
            Long runnerId,
            String runnerEmail
    ) {
    }

    public record NoteDto(Long id, Long authorRunnerId, String authorEmail, String createdAt, String noteText) {
    }

    public record JobDto(
            Long id,
            String jobType,
            String triggerSource,
            String status,
            String summary,
            String createdAt,
            String startedAt,
            String finishedAt,
            String createdByEmail,
            int totalCount,
            int successCount,
            int failureCount,
            String detailsJson
    ) {
    }

    public record AuditDto(
            Long id,
            String createdAt,
            String actorEmail,
            String actorRole,
            String action,
            String targetType,
            String targetId,
            String summary,
            String metadataJson
    ) {
    }

    public record SavedFilterDto(Long id, String scope, String name, String queryJson, String updatedAt) {
    }
}
