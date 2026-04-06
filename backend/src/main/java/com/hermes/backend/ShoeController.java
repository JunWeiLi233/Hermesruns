package com.hermes.backend;

import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shoes")
public class ShoeController {
    private static final Set<String> MATCH_BATCH_FIELDS = Set.of("items");
    private static final Set<String> MATCH_BATCH_ITEM_FIELDS = Set.of("brand", "model");
    private static final Set<String> MERGE_FIELDS = Set.of("keepShoeId", "mergeShoeIds");
    private static final Set<String> CREATE_SHOE_FIELDS = Set.of("brand", "model", "nickname", "maxDistanceKm", "isPrimary", "initialDistanceKm", "photoUrl");
    private static final Set<String> UPDATE_SHOE_FIELDS = Set.of("brand", "model", "nickname", "maxDistanceKm", "retired", "isPrimary", "initialDistanceKm", "photoUrl");

    private final AuthService authService;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final ShoeIdentityService shoeIdentityService;

    public ShoeController(AuthService authService, ShoeRepository shoeRepository,
                          ActivityRepository activityRepository,
                          ShoeIdentityService shoeIdentityService) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.shoeIdentityService = shoeIdentityService;
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
        shoes.forEach(s -> attachCurrentDistance(s, distanceMap));

        return ResponseEntity.ok(shoes);
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
        shoes.forEach(s -> {
            double activityKm = distanceMap2.getOrDefault(s.getId(), 0.0);
            double initial = s.getInitialDistanceKm() != null ? s.getInitialDistanceKm() : 0.0;
            s.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
        });

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
            if (url.length() > 2048) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Photo URL too long.");
            try {
                shoe.setPhotoUrl(SafeUrlValidator.validateHttpUrlOrNull(url, 2048, "photoUrl"));
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
                shoe.setRetired(RequestBodyValidator.booleanOrDefault(body, "retired", false));
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
                shoe.setPhotoUrl(SafeUrlValidator.validateHttpUrlOrNull(url, 2048, "photoUrl"));
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
            shoe.setRetired(true);
            shoeRepository.save(shoe);
            return ResponseEntity.ok(Map.of("message", "Shoe retired"));
        }
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
        for (Object[] row : activityRepository.sumDistanceKmByRunner(runner)) {
            map.put((Long) row[0], ((Number) row[1]).doubleValue());
        }
        return map;
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
}
