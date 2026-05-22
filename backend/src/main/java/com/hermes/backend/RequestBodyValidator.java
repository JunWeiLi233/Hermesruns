package com.hermes.backend;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Strict request-body validation helpers used by controllers that accept JSON maps.
 * <p>
 * We intentionally reject unexpected fields so clients cannot silently smuggle
 * extra state into endpoints that were only designed for a smaller schema.
 * </p>
 */
public final class RequestBodyValidator {
    private RequestBodyValidator() {}

    public static Map<String, Object> requireBody(Map<String, Object> body) {
        if (body == null) {
            throw new IllegalArgumentException("Request body is required.");
        }
        return body;
    }

    public static void rejectUnexpectedFields(Map<String, ?> body, Set<String> allowedFields) {
        if (body == null || body.isEmpty()) return;
        List<String> unexpected = new ArrayList<>();
        for (String field : body.keySet()) {
            if (!allowedFields.contains(field)) {
                unexpected.add(field);
            }
        }
        if (!unexpected.isEmpty()) {
            throw new IllegalArgumentException("Unexpected fields: " + String.join(", ", unexpected));
        }
    }

    public static String requiredString(Map<String, ?> body, String field, int maxLen) {
        String value = optionalString(body, field, maxLen);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required.");
        }
        return value;
    }

    public static String optionalString(Map<String, ?> body, String field, int maxLen) {
        if (body == null || !body.containsKey(field) || body.get(field) == null) {
            return null;
        }
        Object raw = body.get(field);
        if (!(raw instanceof String s)) {
            throw new IllegalArgumentException(field + " must be a string.");
        }
        String trimmed = s.trim();
        InputSanitizer.rejectControlChars(trimmed, field);
        if (trimmed.length() > maxLen) {
            throw new IllegalArgumentException(field + " must be " + maxLen + " characters or fewer.");
        }
        return trimmed;
    }

    public static String optionalSafeText(Map<String, ?> body, String field, int maxLen) {
        String value = optionalString(body, field, maxLen);
        if (value != null) {
            InputSanitizer.rejectControlAndHtmlChars(value, field);
        }
        return value;
    }

    public static String requiredSafeText(Map<String, ?> body, String field, int maxLen) {
        String value = requiredString(body, field, maxLen);
        InputSanitizer.rejectControlAndHtmlChars(value, field);
        return value;
    }

    public static int intOrDefault(Map<String, ?> body, String field, int defaultValue, int min, int max) {
        if (body == null || !body.containsKey(field) || body.get(field) == null) {
            return defaultValue;
        }
        Object raw = body.get(field);
        if (!(raw instanceof Number n)) {
            throw new IllegalArgumentException(field + " must be a number.");
        }
        int value = n.intValue();
        if (value < min || value > max) {
            throw new IllegalArgumentException(field + " must be between " + min + " and " + max + ".");
        }
        return value;
    }

    public static double optionalDouble(Map<String, ?> body, String field, double min, double max, Double defaultValue) {
        if (body == null || !body.containsKey(field) || body.get(field) == null) {
            return defaultValue == null ? Double.NaN : defaultValue;
        }
        Object raw = body.get(field);
        if (!(raw instanceof Number n)) {
            throw new IllegalArgumentException(field + " must be a number.");
        }
        double value = n.doubleValue();
        if (Double.isNaN(value) || Double.isInfinite(value) || value < min || value > max) {
            throw new IllegalArgumentException(field + " must be between " + min + " and " + max + ".");
        }
        return value;
    }

    public static boolean booleanOrDefault(Map<String, ?> body, String field, boolean defaultValue) {
        if (body == null || !body.containsKey(field) || body.get(field) == null) {
            return defaultValue;
        }
        Object raw = body.get(field);
        if (!(raw instanceof Boolean b)) {
            throw new IllegalArgumentException(field + " must be true or false.");
        }
        return b;
    }

    public static List<Long> requireLongList(Map<String, ?> body, String field, int maxItems) {
        if (body == null) {
            throw new IllegalArgumentException(field + " is required.");
        }
        Object raw = body.get(field);
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            throw new IllegalArgumentException(field + " is required.");
        }
        if (list.size() > maxItems) {
            throw new IllegalArgumentException(field + " may contain at most " + maxItems + " items.");
        }
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        for (Object item : list) {
            if (!(item instanceof Number n)) {
                throw new IllegalArgumentException(field + " must only contain numbers.");
            }
            long value = n.longValue();
            if (value <= 0) {
                throw new IllegalArgumentException(field + " must only contain positive IDs.");
            }
            ids.add(value);
        }
        if (ids.isEmpty()) {
            throw new IllegalArgumentException(field + " is required.");
        }
        return List.copyOf(ids);
    }

    public static List<Map<String, Object>> requireObjectList(Map<String, ?> body, String field, int maxItems) {
        if (body == null) {
            throw new IllegalArgumentException(field + " is required.");
        }
        Object raw = body.get(field);
        if (!(raw instanceof List<?> list)) {
            throw new IllegalArgumentException(field + " array required");
        }
        if (list.size() > maxItems) {
            throw new IllegalArgumentException(field + " may contain at most " + maxItems + " items.");
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> row)) {
                throw new IllegalArgumentException(field + " must contain only objects.");
            }
            out.add(castStringObjectMap(row));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> castStringObjectMap(Map<?, ?> raw) {
        for (Object key : raw.keySet()) {
            if (!(key instanceof String)) {
                throw new IllegalArgumentException("JSON object field names must be strings.");
            }
        }
        return (Map<String, Object>) raw;
    }
}
