package com.hermes.backend;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AdminPortalService {

    // The dashboard boot calls the overview endpoint and every tab switch
    // refreshes queues; both payloads run a dozen count/page queries over the
    // same tables. A short TTL memo collapses those into one build while
    // staying too brief to mask an operator's own edits for long. Admin
    // mutations (deletes, bulk actions, notes, shoe/race-map writes) still
    // invalidate immediately via invalidateDashboardCache().
    private static final long DASHBOARD_CACHE_TTL_MS = 15_000;
    private final Object dashboardCacheLock = new Object();
    private volatile Map<String, Object> cachedQueueSummary;
    private volatile long cachedQueueSummaryAtMillis;
    private volatile Map<String, Object> cachedOverview;
    private volatile long cachedOverviewAtMillis;

    private final RunnerRepository runnerRepository;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final RunnerAdminNoteRepository runnerAdminNoteRepository;
    private final AdminSavedFilterRepository adminSavedFilterRepository;
    private final AdminAuditLogRepository adminAuditLogRepository;
    private final AdminBackgroundJobRepository adminBackgroundJobRepository;
    private final AuthService authService;
    private final AdminAuditService adminAuditService;
    private final AiUsageService aiUsageService;
    private final QuotaService quotaService;
    private final ShoeAdminAggregateService shoeAdminAggregateService;
    private final StravaAutoSyncScheduler stravaAutoSyncScheduler;
    private final RaceCourseMapService raceCourseMapService;

    public AdminPortalService(
            RunnerRepository runnerRepository,
            ShoeRepository shoeRepository,
            ActivityRepository activityRepository,
            RunnerAdminNoteRepository runnerAdminNoteRepository,
            AdminSavedFilterRepository adminSavedFilterRepository,
            AdminAuditLogRepository adminAuditLogRepository,
            AdminBackgroundJobRepository adminBackgroundJobRepository,
            AuthService authService,
            AdminAuditService adminAuditService,
            AiUsageService aiUsageService,
            QuotaService quotaService,
            ShoeAdminAggregateService shoeAdminAggregateService,
            StravaAutoSyncScheduler stravaAutoSyncScheduler,
            RaceCourseMapService raceCourseMapService
    ) {
        this.runnerRepository = runnerRepository;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.runnerAdminNoteRepository = runnerAdminNoteRepository;
        this.adminSavedFilterRepository = adminSavedFilterRepository;
        this.adminAuditLogRepository = adminAuditLogRepository;
        this.adminBackgroundJobRepository = adminBackgroundJobRepository;
        this.authService = authService;
        this.adminAuditService = adminAuditService;
        this.aiUsageService = aiUsageService;
        this.quotaService = quotaService;
        this.shoeAdminAggregateService = shoeAdminAggregateService;
        this.stravaAutoSyncScheduler = stravaAutoSyncScheduler;
        this.raceCourseMapService = raceCourseMapService;
    }

    public RunnerRepository getRunnerRepository() { return runnerRepository; }
    public ShoeRepository getShoeRepository() { return shoeRepository; }
    public ActivityRepository getActivityRepository() { return activityRepository; }
    public RunnerAdminNoteRepository getRunnerAdminNoteRepository() { return runnerAdminNoteRepository; }
    public AdminSavedFilterRepository getAdminSavedFilterRepository() { return adminSavedFilterRepository; }
    public AdminAuditLogRepository getAdminAuditLogRepository() { return adminAuditLogRepository; }
    public AdminBackgroundJobRepository getAdminBackgroundJobRepository() { return adminBackgroundJobRepository; }
    public AuthService getAuthService() { return authService; }
    public AdminAuditService getAdminAuditService() { return adminAuditService; }
    public AiUsageService getAiUsageService() { return aiUsageService; }
    public QuotaService getQuotaService() { return quotaService; }
    public ShoeAdminAggregateService getShoeAdminAggregateService() { return shoeAdminAggregateService; }
    public StravaAutoSyncScheduler getStravaAutoSyncScheduler() { return stravaAutoSyncScheduler; }
    public RaceCourseMapService getRaceCourseMapService() { return raceCourseMapService; }

    public Optional<Runner> requireAdmin(String authorizationHeader) {
        return authService.findByAuthorizationHeader(authorizationHeader).filter(authService::isAdmin);
    }

    /**
     * Cached body shared by GET /api/admin/queues and the "queues" key of the
     * overview payload. The returned map (and its nested lists) is
     * defensively immutable so cached entries can never be mutated by callers.
     */
    public Map<String, Object> queueSummary() {
        Map<String, Object> cached = cachedQueueSummary;
        if (cached != null && System.currentTimeMillis() - cachedQueueSummaryAtMillis < DASHBOARD_CACHE_TTL_MS) {
            return cached;
        }
        synchronized (dashboardCacheLock) {
            cached = cachedQueueSummary;
            if (cached != null && System.currentTimeMillis() - cachedQueueSummaryAtMillis < DASHBOARD_CACHE_TTL_MS) {
                return cached;
            }
            Map<String, Object> body = Collections.unmodifiableMap(buildQueueSummaryBody());
            cachedQueueSummary = body;
            cachedQueueSummaryAtMillis = System.currentTimeMillis();
            return body;
        }
    }

    /**
     * Cached full overview payload (KPIs + trends + embedded queues summary)
     * for GET /api/admin/overview. Defensively immutable, same as
     * {@link #queueSummary()}.
     */
    public Map<String, Object> overviewBody() {
        Map<String, Object> cached = cachedOverview;
        if (cached != null && System.currentTimeMillis() - cachedOverviewAtMillis < DASHBOARD_CACHE_TTL_MS) {
            return cached;
        }
        synchronized (dashboardCacheLock) {
            cached = cachedOverview;
            if (cached != null && System.currentTimeMillis() - cachedOverviewAtMillis < DASHBOARD_CACHE_TTL_MS) {
                return cached;
            }
            // Reentrant on dashboardCacheLock: the embedded queues summary may
            // itself be rebuilt here, which is fine because intrinsic monitors
            // are per-thread reentrant.
            Map<String, Object> body = Collections.unmodifiableMap(buildOverviewBody());
            cachedOverview = body;
            cachedOverviewAtMillis = System.currentTimeMillis();
            return body;
        }
    }

    /** Clears both dashboard caches so the next read reflects the database immediately. */
    public void invalidateDashboardCache() {
        synchronized (dashboardCacheLock) {
            cachedQueueSummary = null;
            cachedQueueSummaryAtMillis = 0L;
            cachedOverview = null;
            cachedOverviewAtMillis = 0L;
        }
    }

    /**
     * Transaction-aware variant of {@link #invalidateDashboardCache()} for
     * mutation endpoints annotated with {@code @Transactional}: dropping the
     * cache while the write is still uncommitted would let a concurrent
     * rebuild (READ_COMMITTED) snapshot pre-mutation state and then serve it
     * for up to the full TTL after the commit. Registering the invalidation
     * for {@code afterCompletion} guarantees the caches are cleared once the
     * transaction has actually finished (commit or rollback). Callers running
     * without an active transaction invalidate immediately.
     */
    public void invalidateDashboardCacheAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            invalidateDashboardCache();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                invalidateDashboardCache();
            }
        });
    }

    /**
     * Remove only terminal job history. Active jobs stay visible and keep their
     * persistence record so background workers can finish safely.
     */
    @Transactional
    public Map<String, Object> clearTerminalJobs() {
        long preservedActive = adminBackgroundJobRepository.countByStatusIn(List.of(
                AdminBackgroundJob.STATUS_PENDING,
                AdminBackgroundJob.STATUS_RUNNING));
        int deleted = adminBackgroundJobRepository.deleteByStatusIn(List.of(
                AdminBackgroundJob.STATUS_COMPLETED,
                AdminBackgroundJob.STATUS_FAILED));
        invalidateDashboardCacheAfterCommit();
        return Map.of(
                "deleted", deleted,
                "preservedActive", preservedActive
        );
    }

    /** Remove one audit record and invalidate cached dashboard totals after commit. */
    @Transactional
    public boolean deleteAuditLog(Long id) {
        Optional<AdminAuditLog> auditOptional = adminAuditLogRepository.findById(id);
        if (auditOptional.isEmpty() || auditOptional.get().getDeletedAt() != null) return false;
        auditOptional.get().setDeletedAt(LocalDateTime.now());
        adminAuditLogRepository.save(auditOptional.get());
        invalidateDashboardCacheAfterCommit();
        return true;
    }

    /** Hide the audit history in one batch while retaining it for trend metrics. */
    @Transactional
    public long clearAuditLogs() {
        long deleted = adminAuditLogRepository.countByDeletedAtIsNull();
        adminAuditLogRepository.softDeleteActive(LocalDateTime.now());
        invalidateDashboardCacheAfterCommit();
        return deleted;
    }

    /**
     * Historical audit counts are built from every event row, including rows
     * hidden from the live audit table by an administrator. Keeping the event
     * rows lets this trend remain stable after cleanup actions.
     */
    public List<Map<String, Object>> auditTrend(int days) {
        int normalizedDays = Math.max(1, Math.min(days, 90));
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(normalizedDays - 1L);
        Map<LocalDate, Long> counts = new HashMap<>();
        adminAuditLogRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
                        start.atStartOfDay(),
                        end.plusDays(1).atStartOfDay())
                .forEach(log -> {
                    if (log.getCreatedAt() != null) {
                        counts.merge(log.getCreatedAt().toLocalDate(), 1L, Long::sum);
                    }
                });
        List<Map<String, Object>> trend = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            trend.add(Map.of(
                    "createdAt", date.toString(),
                    "count", counts.getOrDefault(date, 0L)
            ));
        }
        return trend;
    }

    private Map<String, Object> buildOverviewBody() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("kpis", List.of(
                kpi("Active users", runnerRepository.countByDeletedFalse(), List.copyOf(dailyUserTrend(7))),
                kpi("Shoes", shoeRepository.count(), List.copyOf(dailyShoeTrend(7))),
                kpi("Missing shoe images", shoeRepository.count(shoeFilterSpec("", "missing_photo", false)), List.of()),
                kpi("Unverified shoe photos", shoeRepository.count(shoeFilterSpec("", "unverified_photo", false)), List.of()),
                kpi("Recent signup issues", runnerRepository.count(userFilterSpec("", "", "", "recent_signup_issues")), List.of()),
                kpi("Billing exceptions", runnerRepository.count(userFilterSpec("", "", "", "billing_exceptions")), List.of()),
                kpi("Failed sync jobs", adminBackgroundJobRepository.countByStatusIn(
                        List.of(AdminBackgroundJob.STATUS_FAILED)), List.of())
        ));
        response.put("queues", queueSummary());
        response.put("recentJobs", adminBackgroundJobRepository.findTop10ByStatusInOrderByCreatedAtDesc(
                        List.of(AdminBackgroundJob.STATUS_RUNNING, AdminBackgroundJob.STATUS_FAILED, AdminBackgroundJob.STATUS_COMPLETED))
                .stream()
                .map(this::toJobDto)
                .toList());
        return response;
    }

    private Map<String, Object> buildQueueSummaryBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unverifiedShoePhotos", List.copyOf(shoeRepository.findAll(shoeFilterSpec("", "unverified_photo", false), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(this::toShoeDto).getContent()));
        body.put("missingShoeImages", List.copyOf(shoeRepository.findAll(shoeFilterSpec("", "missing_photo", false), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(this::toShoeDto).getContent()));
        body.put("pendingRaceCourseMaps", raceCourseMapService.listRaceCourseMaps().stream().filter(RaceCourseMapAdminRow::hasPendingPreview).limit(8).toList());
        body.put("recentSignupIssues", List.copyOf(runnerRepository.findAll(userFilterSpec("", "", "", "recent_signup_issues"), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(r -> toUserDto(r, 0)).getContent()));
        body.put("billingExceptions", List.copyOf(runnerRepository.findAll(userFilterSpec("", "", "", "billing_exceptions"), PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt"))).map(r -> toUserDto(r, 0)).getContent()));
        body.put("failedSyncs", adminBackgroundJobRepository.findTop10ByStatusInOrderByCreatedAtDesc(List.of(AdminBackgroundJob.STATUS_FAILED)).stream().map(this::toJobDto).limit(8).toList());
        return body;
    }

    public Specification<Runner> userFilterSpec(String search, String role, String status, String queue) {
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

    public Specification<Shoe> shoeFilterSpec(String search, String queue, boolean includeRetired) {
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

    public Map<Long, Long> loadNoteCounts(List<Runner> runners) {
        if (runners.isEmpty()) return Map.of();
        Map<Long, Long> counts = new HashMap<>();
        List<Long> runnerIds = runners.stream().map(Runner::getId).toList();
        for (Object[] row : runnerAdminNoteRepository.countGroupedByRunnerIds(runnerIds)) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    public UserAdminDto toUserDto(Runner runner, long noteCount) {
        Map<String, Object> shoeQuota = shoeScanQuota(runner);
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
                noteCount,
                intValue(shoeQuota.get("used"), 0),
                intValue(shoeQuota.get("limit"), 0),
                intValue(shoeQuota.get("remaining"), 0)
        );
    }

    private Map<String, Object> shoeScanQuota(Runner runner) {
        if (runner == null || quotaService == null) {
            return Map.of("used", 0, "limit", 0, "remaining", 0);
        }
        Object raw = quotaService.getQuotaStatus(runner).get("shoeScan");
        if (raw instanceof Map<?, ?> map) {
            Map<String, Object> typed = new LinkedHashMap<>();
            typed.put("used", map.get("used"));
            typed.put("limit", map.get("limit"));
            typed.put("remaining", map.get("remaining"));
            return typed;
        }
        return Map.of("used", 0, "limit", 0, "remaining", 0);
    }

    private int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String stringValue) {
            try {
                return Integer.parseInt(stringValue.trim());
            } catch (Exception ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    public ShoeAdminDto toShoeDto(Shoe shoe) {
        return shoeAdminAggregateService.toShoeDto(shoe);
    }

    public ShoeAdminDto toShoeDto(Shoe shoe, ShoeImageAsset asset) {
        return shoeAdminAggregateService.toShoeDto(shoe, asset);
    }

    public NoteDto toNoteDto(RunnerAdminNote note) {
        return new NoteDto(note.getId(), note.getAuthorRunnerId(), note.getAuthorEmail(), note.getCreatedAt().toString(), note.getNoteText());
    }

    public JobDto toJobDto(AdminBackgroundJob job) {
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

    public AuditDto toAuditDto(AdminAuditLog log) {
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

    public SavedFilterDto toSavedFilterDto(AdminSavedFilter filter) {
        return new SavedFilterDto(
                filter.getId(),
                filter.getScope(),
                filter.getName(),
                filter.getQueryJson(),
                filter.getUpdatedAt() == null ? null : filter.getUpdatedAt().toString()
        );
    }

    public Map<String, Object> kpi(String label, long value, List<Map<String, Object>> trend) {
        return Map.of("label", label, "value", value, "trend", trend);
    }

    public List<Map<String, Object>> dailyUserTrend(int days) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            LocalDateTime dayStart = date.atStartOfDay();
            long count = runnerRepository.countActiveByCreatedAtWindow(dayStart, dayStart.plusDays(1));
            out.add(Map.of("label", date.toString(), "value", count));
        }
        return out;
    }

    public List<Map<String, Object>> dailyShoeTrend(int days) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            LocalDateTime dayStart = date.atStartOfDay();
            long count = shoeRepository.countByCreatedAtWindow(dayStart, dayStart.plusDays(1));
            out.add(Map.of("label", date.toString(), "value", count));
        }
        return out;
    }

    public Pageable buildPageable(int page, int size, String sortBy, String sortDirection, Set<String> allowedFields) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        String property = allowedFields.contains(sortBy) ? sortBy : "id";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(safePage, safeSize, Sort.by(direction, property));
    }

    public Optional<Runner> resolveRunnerForShoe(Map<String, Object> body) {
        if (body == null) return Optional.empty();
        if (body.get("runnerId") instanceof Number number) {
            return runnerRepository.findById(number.longValue());
        }
        if (body.get("runnerEmail") instanceof String email && !email.isBlank()) {
            return runnerRepository.findByEmailIgnoreCase(email.trim());
        }
        return Optional.empty();
    }

    public Double readOptionalDouble(Map<String, Object> body, String field) {
        if (body == null || !body.containsKey(field) || body.get(field) == null) {
            return null;
        }
        return RequestBodyValidator.optionalDouble(body, field, -180, 100000, null);
    }

    public BulkSelection parseSelection(Map<String, Object> body) {
        Object idsRaw = body == null ? null : body.get("ids");
        if (!(idsRaw instanceof List<?> rawIds)) return new BulkSelection(List.of());
        List<Long> ids = rawIds.stream().filter(Number.class::isInstance).map(Number.class::cast).map(Number::longValue).distinct().toList();
        return new BulkSelection(ids);
    }

    public boolean isShoeBulkActionApplicable(Shoe shoe, String action) {
        return switch (action) {
            case "verify_photo" -> shoe.getPhotoUrl() != null && !shoe.getPhotoUrl().isBlank() && !shoe.isPhotoVerified();
            case "unverify_photo" -> shoe.getPhotoUrl() != null && !shoe.getPhotoUrl().isBlank() && shoe.isPhotoVerified();
            case "clear_photo" -> shoe.getPhotoUrl() != null && !shoe.getPhotoUrl().isBlank();
            default -> false;
        };
    }

    public String csvCell(String value) {
        String safe = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + safe + "\"";
    }
}
