package com.hermes.backend;

import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/shoes")
public class ShoeController {

    private final AuthService authService;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;

    public ShoeController(AuthService authService, ShoeRepository shoeRepository,
                          ActivityRepository activityRepository) {
        this.authService = authService;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
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

        Map<Long, Double> distanceMap = buildShoeDistanceMap(user.get());
        shoes.forEach(s -> {
            double activityKm = distanceMap.getOrDefault(s.getId(), 0.0);
            double initial = s.getInitialDistanceKm() != null ? s.getInitialDistanceKm() : 0.0;
            s.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
        });

        return ResponseEntity.ok(shoes);
    }

    @GetMapping("/recent")
    public ResponseEntity<?> recentShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(user.get());

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
}
