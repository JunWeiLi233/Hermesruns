package com.hermes.backend.shoes;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.web.InputSanitizer;
import com.hermes.backend.infrastructure.web.RequestBodyValidator;
import com.hermes.backend.infrastructure.web.SafeUrlValidator;
import com.hermes.backend.runner.Runner;
import java.util.*;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

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
    private final ShoeInventoryService inventory;

    public ShoeController(AuthService authService, ShoeInventoryService inventory) {
        this.authService = authService;
        this.inventory = inventory;
    }

    @GetMapping
    public ResponseEntity<?> listShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "includeRetired", defaultValue = "false") boolean includeRetired) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        return ResponseEntity.ok(inventory.listShoes(user.get(), includeRetired));
    }

    @GetMapping("/recommendation")
    public ResponseEntity<?> recommendation(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "surface", required = false) String surfaceOverride) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        return ResponseEntity.ok(inventory.recommendation(user.get(), surfaceOverride));
    }

    @GetMapping("/duplicate-clusters")
    public ResponseEntity<?> duplicateClusters(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        return ResponseEntity.ok(Map.of("clusters", inventory.duplicateClusters(user.get())));
    }

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

        ShoeMatchContext matches = inventory.prepareMatchBatch(user.get());
        List<Map<String, Object>> results = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> item : list) {
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
            results.add(inventory.matchShoe(matches, new ShoeMatchRequest(brand, model), index++));
        }
        return ResponseEntity.ok(Map.of("results", results));
    }

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

        ShoeMergeResult result = inventory.mergeShoes(user.get(), keepId, mergeIdsList);
        return switch (result.outcome()) {
            case MERGED -> ResponseEntity.ok(Map.of("message", "Shoes merged", "keepShoeId", result.keepShoeId()));
            case NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", result.error()));
            case NO_TARGETS -> ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", result.error()));
        };
    }

    @GetMapping("/recent")
    public ResponseEntity<?> recentShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        return ResponseEntity.ok(inventory.recentShoes(user.get()));
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

        Double maxDistanceKm = null;
        Double initialDistanceKm = null;
        String photoUrl = null;
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
        if (body.containsKey("maxDistanceKm")) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "maxDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            maxDistanceKm = km;
        }
        if (body.containsKey("initialDistanceKm")) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "initialDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initial distance.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid initial distance.");
            initialDistanceKm = km;
        }
        if (body.get("photoUrl") instanceof String url) {
            if (url.length() > MAX_PHOTO_REFERENCE_LENGTH) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Photo URL too long.");
            try {
                photoUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(url, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }

        ShoeChanges changes = new ShoeChanges(brand, model, nickname, true, maxDistanceKm,
                null, isPrimary, initialDistanceKm, photoUrl, body.get("photoUrl") instanceof String);
        return ResponseEntity.status(HttpStatus.CREATED).body(inventory.createShoe(user.get(), changes));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateShoe(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> body) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        Optional<Shoe> shoeOpt = inventory.findShoe(user.get(), id);
        if (shoeOpt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Shoe not found");

        try {
            RequestBodyValidator.rejectUnexpectedFields(body, UPDATE_SHOE_FIELDS);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        }

        String brand = null;
        String model = null;
        String nickname = null;
        Double maxDistanceKm = null;
        Boolean retired = null;
        Boolean isPrimary = null;
        Double initialDistanceKm = null;
        String photoUrl = null;
        if (body.containsKey("brand") && body.get("brand") instanceof String s) {
            String v = s.trim();
            try {
                InputSanitizer.rejectControlAndHtmlChars(v, "brand");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
            if (v.length() > 100) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Brand too long.");
            brand = v;
        }
        if (body.containsKey("model") && body.get("model") instanceof String s) {
            String v = s.trim();
            try {
                InputSanitizer.rejectControlAndHtmlChars(v, "model");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
            if (v.length() > 100) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Model too long.");
            model = v;
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
            nickname = v;
        }
        if (body.containsKey("maxDistanceKm") && body.get("maxDistanceKm") != null) {
            double km;
            try {
                km = RequestBodyValidator.optionalDouble(body, "maxDistanceKm", 0, 99999, null);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid maxDistanceKm.");
            }
            if (km < 0 || km > 99999) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid max distance.");
            maxDistanceKm = km;
        }
        if (body.containsKey("retired")) {
            try {
                retired = RequestBodyValidator.booleanOrDefault(body, "retired", false);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }
        if (body.containsKey("isPrimary")) {
            try {
                isPrimary = RequestBodyValidator.booleanOrDefault(body, "isPrimary", false);
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
            initialDistanceKm = km;
        }
        if (body.containsKey("photoUrl")) {
            Object urlRaw = body.get("photoUrl");
            String url = urlRaw instanceof String s ? s : null;
            try {
                photoUrl = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(url, MAX_PHOTO_REFERENCE_LENGTH, "photoUrl");
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
            }
        }

        ShoeChanges changes = new ShoeChanges(brand, model, nickname, body.containsKey("nickname"),
                maxDistanceKm, retired, isPrimary, initialDistanceKm, photoUrl, body.containsKey("photoUrl"));
        return ResponseEntity.ok(inventory.updateShoe(shoeOpt.get(), changes));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteShoe(
            @PathVariable Long id,
            @RequestParam(value = "permanent", defaultValue = "false") boolean permanent,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        try {
            inventory.deleteShoe(user.get(), id, permanent);
            return ResponseEntity.ok(Map.of("message", permanent ? "Shoe deleted" : "Shoe retired"));
        } catch (ShoeNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    @PostMapping("/{id}/retire")
    public ResponseEntity<?> retireShoe(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        try {
            Shoe saved = inventory.setRetired(user.get(), id, true);
            return ResponseEntity.ok(Map.of(
                    "message", "Shoe retired",
                    "shoeId", saved.getId(),
                    "retiredDate", saved.getRetiredDate().toString()
            ));
        } catch (ShoeNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<?> reactivateShoe(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        try {
            Shoe saved = inventory.setRetired(user.get(), id, false);
            return ResponseEntity.ok(Map.of("message", "Shoe reactivated", "shoeId", saved.getId()));
        } catch (ShoeNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }

    @GetMapping("/retired")
    public ResponseEntity<?> listRetiredShoes(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        return ResponseEntity.ok(inventory.listRetiredShoes(user.get()));
    }

    @PatchMapping("/{shoeId}/assign/{activityId}")
    @Transactional
    public ResponseEntity<?> assignShoeToActivity(
            @PathVariable Long shoeId,
            @PathVariable Long activityId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> user = authService.findByAuthorizationHeader(authHeader);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");

        try {
            Activity saved = inventory.assignShoeToActivity(user.get(), shoeId, activityId);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("message", "Shoe assignment updated");
            body.put("activityId", saved.getId());
            body.put("shoeId", saved.getShoeId());
            body.put("shoeName", saved.getShoeName());
            return ResponseEntity.ok(body);
        } catch (ShoeNotFoundException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
        }
    }
}
