package com.hermes.backend;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AdminPortalService {

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
        List<Runner> users = runnerRepository.findAll();
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            long count = users.stream().filter(r -> !r.isDeleted() && r.getCreatedAt() != null && date.equals(r.getCreatedAt().toLocalDate())).count();
            out.add(Map.of("label", date.toString(), "value", count));
        }
        return out;
    }

    public List<Map<String, Object>> dailyShoeTrend(int days) {
        List<Shoe> shoes = shoeRepository.findAll();
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            long count = shoes.stream().filter(s -> s.getCreatedAt() != null && date.equals(s.getCreatedAt().toLocalDate())).count();
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
