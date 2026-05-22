package com.hermes.backend;

import org.springframework.http.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shoes")
public class ShoeController {
    private static final int MAX_PHOTO_REFERENCE_LENGTH = 2_000_000;
    private static final Set<String> MATCH_BATCH_FIELDS = Set.of("items");
    private static final Set<String> MATCH_BATCH_ITEM_FIELDS = Set.of("brand", "model");
    private static final Set<String> MERGE_FIELDS = Set.of("keepShoeId", "mergeShoeIds");
    private static final Set<String> CREATE_SHOE_FIELDS = Set.of("brand", "model", "nickname", "maxDistanceKm", "isPrimary", "initialDistanceKm", "photoUrl");
    private static final Set<String> UPDATE_SHOE_FIELDS = Set.of("brand", "model", "nickname", "maxDistanceKm", "retired", "isPrimary", "initialDistanceKm", "photoUrl");

    private final AuthService authService;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final ShoeIdentityService shoeIdentityService;
    private final ShoeCatalogModelRepository shoeCatalogModelRepository;
    private final ShoeTracker shoeTracker;
    private final CoachScheduledWorkoutRepository scheduledWorkoutRepository;

    @Autowired
    public ShoeController(AuthService authService, ShoeRepository shoeRepository,
                          ActivityRepository activityRepository,
                          ShoeIdentityService shoeIdentityService,
                          ShoeCatalogModelRepository shoeCatalogModelRepository,
                          ShoeTracker shoeTracker,
                          CoachScheduledWorkoutRepository scheduledWorkoutRepository) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.shoeIdentityService = shoeIdentityService;
        this.shoeCatalogModelRepository = shoeCatalogModelRepository;
        this.shoeTracker = shoeTracker;
        this.scheduledWorkoutRepository = scheduledWorkoutRepository;
    }

    public ShoeController(AuthService authService, ShoeRepository shoeRepository,
                          ActivityRepository activityRepository,
                          ShoeIdentityService shoeIdentityService,
                          ShoeCatalogModelRepository shoeCatalogModelRepository) {
        this(authService, shoeRepository, activityRepository, shoeIdentityService, shoeCatalogModelRepository, null, null);
    }

    public ShoeController(AuthService authService, ShoeRepository shoeRepository,
                          ActivityRepository activityRepository,
                          ShoeIdentityService shoeIdentityService,
                          ShoeCatalogModelRepository shoeCatalogModelRepository,
                          ShoeTracker shoeTracker) {
        this(authService, shoeRepository, activityRepository, shoeIdentityService, shoeCatalogModelRepository, shoeTracker, null);
    }

    public ShoeController(AuthService authService, ShoeRepository shoeRepository,
                          ActivityRepository activityRepository,
                          ShoeIdentityService shoeIdentityService) {
        this(authService, shoeRepository, activityRepository, shoeIdentityService, null, null, null);
    }

    @GetMapping
    public ResponseEntity<?> listShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "includeRetired", defaultValue = "false") boolean includeRetired) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        List<Shoe> shoes = includeRetired
                ? shoeRepository.findByRunnerOrderByCreatedAtDesc(user.get())
                : shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(user.get());

        backfillIdentityKeys(shoes);
        Map<Long, Double> distanceMap = buildShoeDistanceMap(user.get());
        Map<Long, Object> lastUsedMap = buildLastUsedMap(user.get());
        Map<String, String> typeMap = buildShoeTypeMap();
        shoes.forEach(s -> attachRotationContext(s, distanceMap, lastUsedMap, typeMap));

        return ResponseEntity.ok(shoes);
    }

    @GetMapping("/recommendation")
    public ResponseEntity<?> recommendation(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "surface", required = false) String surfaceOverride) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        LocalDate today = LocalDate.now();
        CoachScheduledWorkout scheduledWorkout = scheduledWorkoutRepository == null
                ? null
                : scheduledWorkoutRepository.findByRunnerAndScheduledDate(user.get(), today).orElse(null);
        SurfacePreference surfacePreference = resolveSurfacePreference(surfaceOverride, scheduledWorkout);
        CoachWorkoutType workoutType = scheduledWorkout == null ? null : scheduledWorkout.getWorkoutType();

        Optional<Shoe> recommended = shoeTracker == null
                ? Optional.empty()
                : shoeTracker.recommendShoe(user.get(), workoutType, surfacePreference.surface());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("scheduledDate", today);
        body.put("scheduledWorkoutType", workoutType == null ? null : workoutType.name());
        body.put("targetSurface", surfacePreference.surface());
        body.put("targetSurfaceSource", surfacePreference.source());
        body.put("recommendedShoe", recommended.map(shoe -> recommendationPayload(shoe, workoutType, surfacePreference.surface())).orElse(null));
        return ResponseEntity.ok(body);
    }

    /**
     * Groups of shoes that share the same {@link Shoe#getIdentityKey()} (e.g. Chinese vs romanized name).
     */
    @GetMapping("/duplicate-clusters")
    public ResponseEntity<?> duplicateClusters(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseAndIdentityKeyNotNull(user.get());
        backfillIdentityKeys(shoes);
        Map<Long, Double> distanceMap = buildShoeDistanceMap(user.get());
        shoes.forEach(s -> attachCurrentDistance(s, distanceMap));

        Map<String, List<Shoe>> byKey = new LinkedHashMap<>();
        for (Shoe s : shoes) {
            String key = s.getIdentityKey();
            if (key == null || key.isBlank() || "na".equals(key)) continue;
            byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }

        List<Map<String, Object>> clusters = byKey.entrySet().stream()
                .filter(e -> e.getValue().size() > 1)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("identityKey", e.getKey());
                    m.put("shoes", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("clusters", clusters));
    }

    /**
     * Match scanned or typed brand/model pairs to existing shoes (same identity fingerprint).
     */
    @PostMapping("/match-batch")
    public ResponseEntity<?> matchBatch(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        final List<Map<String, Object>> list;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, MATCH_BATCH_FIELDS);
            list = RequestBodyValidator.requireObjectList(body, "items", 50);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        Runner runner = user.get();
        List<Shoe> allShoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        backfillIdentityKeys(allShoes);
        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        Map<String, List<Shoe>> byIdentity = new HashMap<>();
        for (Shoe s : allShoes) {
            String key = s.getIdentityKey();
            if (key == null) continue;
            byIdentity.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }

        List<Map<String, Object>> results = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> item : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("index", index++);
            try {
                RequestBodyValidator.rejectUnexpectedFields(item, MATCH_BATCH_ITEM_FIELDS);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
            }
            String brand = item.get("brand") instanceof String s ? s.trim() : "";
            String model = item.get("model") instanceof String s ? s.trim() : "";
            try {
                InputSanitizer.rejectControlAndHtmlChars(brand, "brand");
                InputSanitizer.rejectControlAndHtmlChars(model, "model");
                InputSanitizer.requireMaxLen(brand, 100, "brand");
                InputSanitizer.requireMaxLen(model, 100, "model");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
            }
            String idKey = shoeIdentityService.computeIdentityKey(brand, model);
            row.put("identityKey", idKey);
            List<Shoe> matches = new ArrayList<>(byIdentity.getOrDefault(idKey, List.of()));
            matches.forEach(s -> attachCurrentDistance(s, distanceMap));
            row.put("matches", matches);
            results.add(row);
        }

        return ResponseEntity.ok(Map.of("results", results));
    }

    /**
     * Reassign activities from duplicate shoes onto one keeper, then remove merged shoe rows.
     */
    @PostMapping("/merge")
    @Transactional
    public ResponseEntity<?> mergeShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        final long keepId;
        final List<Long> mergeIdsList;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, MERGE_FIELDS);
            keepId = RequestBodyValidator.intOrDefault(body, "keepShoeId", -1, 1, Integer.MAX_VALUE);
            mergeIdsList = RequestBodyValidator.requireLongList(body, "mergeShoeIds", 50);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
        }

        Optional<Shoe> keepOpt = shoeRepository.findByIdAndRunner(keepId, user.get());
        if (keepOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Keeper shoe not found"));

        Shoe keep = keepOpt.get();
        Set<Long> mergeIds = new LinkedHashSet<>(mergeIdsList);
        mergeIds.remove(keepId);
        if (mergeIds.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No merge targets"));
        }

        double extraInitial = 0.0;
        for (Long mid : mergeIds) {
            Optional<Shoe> mOpt = shoeRepository.findByIdAndRunner(mid, user.get());
            if (mOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Merge shoe not found: " + mid));
            }
            Shoe m = mOpt.get();
            if (m.getInitialDistanceKm() != null) {
                extraInitial += m.getInitialDistanceKm();
            }
            if ((keep.getPhotoUrl() == null || keep.getPhotoUrl().isBlank())
                    && m.getPhotoUrl() != null && !m.getPhotoUrl().isBlank()) {
                keep.setPhotoUrl(m.getPhotoUrl());
            }
            activityRepository.reassignActivitiesToShoe(user.get(), keep, mid);
            shoeRepository.delete(m);
        }

        if (extraInitial > 0) {
            double base = keep.getInitialDistanceKm() != null ? keep.getInitialDistanceKm() : 0.0;
            keep.setInitialDistanceKm(Math.round((base + extraInitial) * 100.0) / 100.0);
        }
        shoeIdentityService.applyIdentityKey(keep);
        shoeRepository.save(keep);

        return ResponseEntity.ok(Map.of(
                "message", "Shoes merged",
                "keepShoeId", keep.getId()
        ));
    }

    @GetMapping("/recent")
    public ResponseEntity<?> recentShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(user.get());
        backfillIdentityKeys(shoes);

        // Build map of shoeId → last used date
        Map<Long, Object> lastUsed = new HashMap<>();
        for (Object[] row : activityRepository.findLastUsedDateByRunner(user.get())) {
            lastUsed.put((Long) row[0], row[1]);
        }

        Map<Long, Double> distanceMap2 = buildShoeDistanceMap(user.get());
        Map<String, String> typeMap = buildShoeTypeMap();
        shoes.forEach(s -> attachRotationContext(s, distanceMap2, lastUsed, typeMap));

        // Sort: shoes with recent activity first, then by last used date desc, unlinked shoes last
        shoes.sort((a, b) -> {
            Object da = lastUsed.get(a.getId());
            Object db = lastUsed.get(b.getId());
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return ((Comparable<Object>) db).compareTo(da);
        });

        return ResponseEntity.ok(shoes);
    }

    @PostMapping
    public ResponseEntity<?> createShoe(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        final String brand;
        final String model;
        final String nickname;
        final boolean isPrimary;
        try {
            RequestBodyValidator.rejectUnexpectedFields(body, CREATE_SHOE_FIELDS);
            brand = RequestBodyValidator.requiredSafeText(body, "brand", 100);
            model = RequestBodyValidator.requiredSafeText(body, "model", 100);
            nickname = RequestBodyValidator.optionalSafeText(body, "nickname", 80);
            isPrimary = RequestBodyValidator.booleanOrDefault(body, "isPrimary", false);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }

        try {
            InputSanitizer.rejectControlAndHtmlChars(brand, "brand");
            InputSanitizer.rejectControlAndHtmlChars(model, "model");
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }

        if (brand.length() > 100 || model.length() > 100) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Brand and model must be 100 characters or fewer.");
        }

        Shoe shoe = new Shoe();
        shoe.setRunner(user.get());
        shoe.setBrand(brand);
        shoe.setModel(model);
        if (nickname != null) {
            try {
                InputSanitizer.rejectControlAndHtmlChars(nickname, "nickname");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
            if (nickname.length() > 80) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Nickname must be 80 characters or fewer.");
            }
        }
        shoe.setNickname(nickname);
        if (body.containsKey("maxDistanceKm")) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "maxDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            shoe.setMaxDistanceKm(km);
        }
        if (isPrimary) {
            shoe.setIsPrimary(true);
        }
        if (body.containsKey("initialDistanceKm")) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "initialDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initial distance.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initial distance.");
            shoe.setInitialDistanceKm(km);
        }
        if (body.get("photoUrl") instanceof String url) {
            if (url.length() > MAX_PHOTO_REFERENCE_LENGTH) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Photo URL too long.");
            try {
                shoe.setPhotoUrl(SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(url, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl"));
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }

        shoeIdentityService.applyIdentityKey(shoe);
        Shoe saved = shoeRepository.save(shoe);
        double initial = saved.getInitialDistanceKm() != null ? saved.getInitialDistanceKm() : 0.0;
        saved.setCurrentDistanceKm(initial);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateShoe(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, UPDATE_SHOE_FIELDS);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }

        Shoe shoe = shoeOpt.get();
        if (body.containsKey("brand") && body.get("brand") instanceof String s) {
            String v = s.trim();
            try {
                InputSanitizer.rejectControlAndHtmlChars(v, "brand");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
            if (v.length() > 100) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Brand too long.");
            shoe.setBrand(v);
        }
        if (body.containsKey("model") && body.get("model") instanceof String s) {
            String v = s.trim();
            try {
                InputSanitizer.rejectControlAndHtmlChars(v, "model");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
            if (v.length() > 100) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Model too long.");
            shoe.setModel(v);
        }
        if (body.containsKey("nickname")) {
            Object nickRaw = body.get("nickname");
            String v = nickRaw instanceof String s ? s.trim() : null;
            if (v != null) {
                try {
                    InputSanitizer.rejectControlAndHtmlChars(v, "nickname");
                } catch (IllegalArgumentException ex) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
                }
                if (v.length() > 80) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Nickname too long.");
            }
            shoe.setNickname(v);
        }
        if (body.containsKey("maxDistanceKm") && body.get("maxDistanceKm") != null) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "maxDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid maxDistanceKm.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            shoe.setMaxDistanceKm(km);
        }
        if (body.containsKey("retired")) {
            try {
                applyRetiredState(shoe, RequestBodyValidator.booleanOrDefault(body, "retired", false));
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }
        if (body.containsKey("isPrimary")) {
            try {
                shoe.setIsPrimary(RequestBodyValidator.booleanOrDefault(body, "isPrimary", false));
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }
        if (body.containsKey("initialDistanceKm") && body.get("initialDistanceKm") != null) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "initialDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initialDistanceKm.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initial distance.");
            shoe.setInitialDistanceKm(km);
        }
        if (body.containsKey("photoUrl")) {
            Object urlRaw = body.get("photoUrl");
            String url = urlRaw instanceof String s ? s : null;
            try {
                shoe.setPhotoUrl(SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(url, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl"));
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }

        shoeIdentityService.applyIdentityKey(shoe);
        Shoe saved = shoeRepository.save(shoe);
        double activityKm = activityRepository.sumDistanceKmByShoeId(saved.getId());
        double initial = saved.getInitialDistanceKm() != null ? saved.getInitialDistanceKm() : 0.0;
        saved.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteShoe(
            @PathVariable Long id,
            @RequestParam(value = "permanent", defaultValue = "false") boolean permanent,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        if (permanent) {
            // Hard delete: unlink from activities, then remove from DB
            activityRepository.unlinkShoeFromActivities(id);
            shoeRepository.delete(shoeOpt.get());
            return ResponseEntity.ok(Map.of("message", "Shoe deleted"));
        } else {
            // Soft-delete: retire the shoe so activity links remain valid
            Shoe shoe = shoeOpt.get();
            applyRetiredState(shoe, true);
            shoeRepository.save(shoe);
            return ResponseEntity.ok(Map.of("message", "Shoe retired"));
        }
    }

    @PostMapping("/{id}/retire")
    public ResponseEntity<?> retireShoe(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        applyRetiredState(shoe, true);
        Shoe saved = shoeRepository.save(shoe);

        double activityKm = activityRepository.sumDistanceKmByShoeId(saved.getId());
        double initial = saved.getInitialDistanceKm() != null ? saved.getInitialDistanceKm() : 0.0;
        saved.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);

        return ResponseEntity.ok(Map.of(
                "message", "Shoe retired",
                "shoeId", saved.getId(),
                "retiredDate", saved.getRetiredDate().toString()
        ));
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<?> reactivateShoe(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(id, user.get());
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        Shoe shoe = shoeOpt.get();
        applyRetiredState(shoe, false);
        Shoe saved = shoeRepository.save(shoe);

        double activityKm = activityRepository.sumDistanceKmByShoeId(saved.getId());
        double initial = saved.getInitialDistanceKm() != null ? saved.getInitialDistanceKm() : 0.0;
        saved.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);

        return ResponseEntity.ok(Map.of(
                "message", "Shoe reactivated",
                "shoeId", saved.getId()
        ));
    }

    @GetMapping("/retired")
    public ResponseEntity<?> listRetiredShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        List<Shoe> retiredShoes = shoeRepository.findByRunnerAndRetiredTrueOrderByRetiredDateDesc(user.get());

        Map<Long, Double> distanceMap = buildShoeDistanceMap(user.get());
        Map<Long, Object> lastUsedMap = buildLastUsedMap(user.get());
        Map<String, String> typeMap = buildShoeTypeMap();
        retiredShoes.forEach(s -> attachRotationContext(s, distanceMap, lastUsedMap, typeMap));

        return ResponseEntity.ok(retiredShoes);
    }

    @PatchMapping("/{shoeId}/assign/{activityId}")
    public ResponseEntity<?> assignShoeToActivity(
            @PathVariable Long shoeId,
            @PathVariable Long activityId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(activityId, user.get());
        if (activityOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Activity not found");
        }

        Activity activity = activityOpt.get();

        if (shoeId == 0) {
            // Unassign shoe
            activity.setShoe(null);
        } else {
            Optional<Shoe> shoeOpt = shoeRepository.findByIdAndRunner(shoeId, user.get());
            if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");
            activity.setShoe(shoeOpt.get());
        }

        activityRepository.save(activity);
        return ResponseEntity.ok(Map.of("message", "Shoe assignment updated"));
    }

    private Map<Long, Double> buildShoeDistanceMap(Runner runner) {
        Map<Long, Double> map = new HashMap<>();
        List<Object[]> rows = activityRepository.sumDistanceKmByRunner(runner);
        if (rows == null) return map;
        for (Object[] row : rows) {
            map.put((Long) row[0], ((Number) row[1]).doubleValue());
        }
        return map;
    }

    private Map<Long, Object> buildLastUsedMap(Runner runner) {
        Map<Long, Object> map = new HashMap<>();
        List<Object[]> rows = activityRepository.findLastUsedDateByRunner(runner);
        if (rows == null) return map;
        for (Object[] row : rows) {
            map.put((Long) row[0], row[1]);
        }
        return map;
    }

    private Map<String, String> buildShoeTypeMap() {
        if (shoeCatalogModelRepository == null) return Map.of();
        Map<String, String> map = new HashMap<>();
        List<ShoeCatalogModel> models = shoeCatalogModelRepository.findAll();
        if (models == null) return map;
        for (ShoeCatalogModel model : models) {
            if (model == null || model.getBrand() == null) continue;
            String type = normalizeShoeType(model.getType());
            putTypeKey(map, model.getBrand().getName(), model.getName(), type);
            putTypeKey(map, model.getBrand().getName(), model.getNameEn(), type);
            putTypeKey(map, model.getBrand().getName(), model.getNameZh(), type);
        }
        return map;
    }

    private void putTypeKey(Map<String, String> map, String brand, String model, String type) {
        String key = typeKey(brand, model);
        if (!key.isBlank()) map.put(key, type);
    }

    private void backfillIdentityKeys(List<Shoe> shoes) {
        for (Shoe s : shoes) {
            if (s.getIdentityKey() == null || s.getIdentityKey().isBlank()) {
                shoeIdentityService.applyIdentityKey(s);
                shoeRepository.save(s);
            }
        }
    }

    private void attachCurrentDistance(Shoe s, Map<Long, Double> distanceMap) {
        double activityKm = distanceMap.getOrDefault(s.getId(), 0.0);
        double initial = s.getInitialDistanceKm() != null ? s.getInitialDistanceKm() : 0.0;
        s.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
    }

    private void attachRotationContext(Shoe shoe, Map<Long, Double> distanceMap, Map<Long, Object> lastUsedMap, Map<String, String> typeMap) {
        attachCurrentDistance(shoe, distanceMap);

        String type = typeMap.get(typeKey(shoe.getBrand(), shoe.getModel()));
        if (type == null) type = inferShoeType(shoe);
        shoe.setType(type);
        shoe.setSurfaceType("trail".equals(type) ? "trail" : "road");

        LocalDateTime lastWornAt = toLocalDateTime(lastUsedMap.get(shoe.getId()));
        shoe.setLastWornAt(lastWornAt);
        if (lastWornAt == null) {
            shoe.setDaysSinceLastWear(null);
        } else {
            long days = ChronoUnit.DAYS.between(lastWornAt.toLocalDate(), LocalDate.now());
            shoe.setDaysSinceLastWear((int) Math.max(0, days));
        }
    }

    private Map<String, Object> recommendationPayload(Shoe shoe, CoachWorkoutType workoutType, String targetSurface) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", shoe.getId());
        payload.put("brand", shoe.getBrand());
        payload.put("model", shoe.getModel());
        payload.put("nickname", shoe.getNickname());
        payload.put("photoUrl", shoe.getPhotoUrl());
        payload.put("type", shoe.getType());
        payload.put("surfaceType", shoe.getSurfaceType());
        payload.put("currentDistanceKm", shoe.getCurrentDistanceKm());
        payload.put("maxDistanceKm", shoe.getMaxDistanceKm());
        payload.put("lastWornAt", shoe.getLastWornAt());
        payload.put("daysSinceLastWear", shoe.getDaysSinceLastWear());
        String workoutLabel = workoutType == null ? "today's run" : workoutType.name() + " workout";
        String surfaceLabel = targetSurface == null ? "rotation" : targetSurface + " surface";
        payload.put("recommendationReason", "Best match for " + surfaceLabel + " and " + workoutLabel);
        return payload;
    }

    private SurfacePreference resolveSurfacePreference(String surfaceOverride, CoachScheduledWorkout scheduledWorkout) {
        String normalizedOverride = normalizeSurface(surfaceOverride);
        if (normalizedOverride != null) {
            return new SurfacePreference(normalizedOverride, "query");
        }
        String scheduledSurface = inferScheduledSurface(scheduledWorkout);
        if (scheduledSurface != null) {
            return new SurfacePreference(scheduledSurface, "schedule");
        }
        return new SurfacePreference(null, "rotation");
    }

    private String inferScheduledSurface(CoachScheduledWorkout scheduledWorkout) {
        if (scheduledWorkout == null || scheduledWorkout.getNotes() == null) return null;
        String notes = scheduledWorkout.getNotes().toLowerCase(Locale.ROOT);
        if (notes.contains("trail")) return "trail";
        if (notes.contains("road")) return "road";
        return null;
    }

    private String normalizeSurface(String surface) {
        if (surface == null) return null;
        String normalized = surface.trim().toLowerCase(Locale.ROOT);
        if ("trail".equals(normalized)) return "trail";
        if ("road".equals(normalized)) return "road";
        return null;
    }

    private String typeKey(String brand, String model) {
        return ((brand == null ? "" : brand) + "::" + (model == null ? "" : model))
                .trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\s\\-_'’.,/]+", "");
    }

    private String normalizeShoeType(String type) {
        String normalized = type == null ? "" : type.trim().toLowerCase(Locale.ROOT);
        if (Set.of("daily", "speed", "race", "trail", "stability").contains(normalized)) return normalized;
        return "daily";
    }

    private String inferShoeType(Shoe shoe) {
        String combined = String.join(" ",
                shoe.getBrand() == null ? "" : shoe.getBrand(),
                shoe.getModel() == null ? "" : shoe.getModel(),
                shoe.getNickname() == null ? "" : shoe.getNickname()
        ).toLowerCase(Locale.ROOT);
        if (combined.contains("trail")
                || combined.contains("speedgoat")
                || combined.contains("mafate")
                || combined.contains("peregrine")
                || combined.contains("torrent")
                || combined.contains("kiger")
                || combined.contains("terrex")) {
            return "trail";
        }
        return "daily";
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) return localDateTime;
        if (value instanceof Timestamp timestamp) return timestamp.toLocalDateTime();
        if (value instanceof java.sql.Date date) return date.toLocalDate().atStartOfDay();
        if (value instanceof Date date) return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
        return null;
    }

    private void applyRetiredState(Shoe shoe, boolean retired) {
        shoe.setRetired(retired);
        if (retired) {
            if (shoe.getRetiredDate() == null) {
                shoe.setRetiredDate(LocalDateTime.now());
            }
        } else {
            shoe.setRetiredDate(null);
        }
    }

    private record SurfacePreference(String surface, String source) {}
}
