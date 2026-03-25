package com.hermes.backend;

import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shoes")
public class ShoeController {

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

        Object raw = body.get("items");
        if (!(raw instanceof List<?> list)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "items array required"));
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
        for (Object o : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("index", index++);
            if (!(o instanceof Map<?, ?> item)) {
                row.put("identityKey", "");
                row.put("matches", List.of());
                results.add(row);
                continue;
            }
            String brand = item.get("brand") instanceof String s ? s.trim() : "";
            String model = item.get("model") instanceof String s ? s.trim() : "";
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

        Object keepRaw = body.get("keepShoeId");
        if (!(keepRaw instanceof Number)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "keepShoeId required"));
        }
        long keepId = ((Number) keepRaw).longValue();

        Object mergeRaw = body.get("mergeShoeIds");
        if (!(mergeRaw instanceof List<?> mergeList) || mergeList.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "mergeShoeIds required"));
        }

        Optional<Shoe> keepOpt = shoeRepository.findByIdAndRunner(keepId, user.get());
        if (keepOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Keeper shoe not found"));

        Shoe keep = keepOpt.get();
        Set<Long> mergeIds = new LinkedHashSet<>();
        for (Object o : mergeList) {
            if (o instanceof Number n) mergeIds.add(n.longValue());
        }
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

        String brand = body.get("brand") instanceof String s ? s.trim() : "";
        String model = body.get("model") instanceof String s ? s.trim() : "";
        if (brand.length() > 100 || model.length() > 100) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Brand and model must be 100 characters or fewer.");
        }

        Shoe shoe = new Shoe();
        shoe.setRunner(user.get());
        shoe.setBrand(brand);
        shoe.setModel(model);
        shoe.setNickname(body.get("nickname") instanceof String s ? s.trim() : null);
        if (body.get("maxDistanceKm") instanceof Number n) {
            double km = n.doubleValue();
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            shoe.setMaxDistanceKm(km);
        }
        if (Boolean.TRUE.equals(body.get("isPrimary"))) {
            shoe.setIsPrimary(true);
        }
        if (body.get("initialDistanceKm") instanceof Number n) {
            double km = n.doubleValue();
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initial distance.");
            shoe.setInitialDistanceKm(km);
        }
        if (body.get("photoUrl") instanceof String url) {
            if (url.length() > 2048) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Photo URL too long.");
            shoe.setPhotoUrl(url.isBlank() ? null : url);
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

        Shoe shoe = shoeOpt.get();
        if (body.containsKey("brand")) shoe.setBrand((String) body.get("brand"));
        if (body.containsKey("model")) shoe.setModel((String) body.get("model"));
        if (body.containsKey("nickname")) shoe.setNickname((String) body.get("nickname"));
        if (body.containsKey("maxDistanceKm") && body.get("maxDistanceKm") != null) {
            shoe.setMaxDistanceKm(((Number) body.get("maxDistanceKm")).doubleValue());
        }
        if (body.containsKey("retired")) shoe.setRetired(Boolean.TRUE.equals(body.get("retired")));
        if (body.containsKey("isPrimary")) shoe.setIsPrimary(Boolean.TRUE.equals(body.get("isPrimary")));
        if (body.containsKey("initialDistanceKm") && body.get("initialDistanceKm") != null) {
            shoe.setInitialDistanceKm(((Number) body.get("initialDistanceKm")).doubleValue());
        }
        if (body.containsKey("photoUrl")) {
            shoe.setPhotoUrl((String) body.get("photoUrl"));
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

        Optional<Activity> activityOpt = activityRepository.findById(activityId);
        if (activityOpt.isEmpty() || !activityOpt.get().getRunner().getId().equals(user.get().getId())) {
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
