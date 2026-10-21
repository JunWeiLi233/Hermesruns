package com.hermes.backend.races;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class OsrmMapMatchingClient {
    // OSRM defaults to 100 locations; hosted servers may configure a lower limit.
    private static final int MAX_MATCH_LOCATIONS = 100;
    private final RestTemplate restTemplate;

    @Value("${app.route-matching.osrm.base-url:${APP_ROUTE_MATCHING_OSRM_BASE_URL:https://router.project-osrm.org}}")
    private String osrmBaseUrl = "https://router.project-osrm.org";

    @Value("${app.route-matching.osrm.profile:${APP_ROUTE_MATCHING_OSRM_PROFILE:driving}}")
    private String osrmProfile = "driving";

    public OsrmMapMatchingClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<MatchedBreadcrumbPointDTO> matchOrderedBreadcrumbs(List<RawBreadcrumbPointDTO> rawBreadcrumbs) {
        validateRawBreadcrumbs(rawBreadcrumbs);

        List<MatchedBreadcrumbPointDTO> matched = new ArrayList<>(rawBreadcrumbs.size());
        int batchLimit = MAX_MATCH_LOCATIONS;
        int start = 0;
        while (start < rawBreadcrumbs.size() - 1) {
            List<RawBreadcrumbPointDTO> batch = rawBreadcrumbs.subList(
                    start, Math.min(start + batchLimit, rawBreadcrumbs.size()));
            ResponseEntity<Map> response;
            try {
                response = restTemplate.exchange(buildMatchUrl(batch), HttpMethod.GET, HttpEntity.EMPTY, Map.class);
            } catch (HttpClientErrorException error) {
                boolean tooLarge = error.getStatusCode().value() == 414
                        || (error.getStatusCode().value() == 400
                        && error.getResponseBodyAsString().matches("(?s).*\"code\"\\s*:\\s*\"TooBig\".*"));
                if (tooLarge && batch.size() > 2) {
                    batchLimit = Math.max(2, Math.min(batchLimit / 2, batch.size() - 1));
                    continue;
                }
                // Do not expose long coordinate URLs or upstream HTML in dashboard errors.
                throw new IllegalStateException("OSRM map matching request failed (HTTP "
                        + error.getStatusCode().value() + "). Check route alignment and server limits.", error);
            }
            List<MatchedBreadcrumbPointDTO> batchMatched = parseMatchedBreadcrumbs(batch, response.getBody());
            // Share a boundary point for matching context, then keep it only once.
            matched.addAll(batchMatched.subList(start == 0 ? 0 : 1, batchMatched.size()));
            start += batch.size() - 1;
        }
        return List.copyOf(matched);
    }

    String matchingSemanticsNote() {
        return "OSRM map matching is scaffolded with the '" + normalizedProfile() + "' profile. "
                + "OSRM does not provide the same walking semantics as Google Snap to Roads on the default public service, "
                + "so if marathon walking semantics matter, point APP_ROUTE_MATCHING_OSRM_BASE_URL "
                + "(or app.route-matching.osrm.base-url) at a custom OSRM deployment and set "
                + "APP_ROUTE_MATCHING_OSRM_PROFILE (or app.route-matching.osrm.profile) to the profile that deployment exposes.";
    }

    private void validateRawBreadcrumbs(List<RawBreadcrumbPointDTO> rawBreadcrumbs) {
        if (rawBreadcrumbs == null || rawBreadcrumbs.size() < 2) {
            throw new IllegalArgumentException("OSRM map matching requires at least 2 ordered raw breadcrumbs.");
        }
        for (RawBreadcrumbPointDTO rawBreadcrumb : rawBreadcrumbs) {
            if (rawBreadcrumb == null) {
                throw new IllegalArgumentException("Raw breadcrumbs must be non-null.");
            }
        }
    }

    private String buildMatchUrl(List<RawBreadcrumbPointDTO> rawBreadcrumbs) {
        String coordinates = rawBreadcrumbs.stream()
                .map(point -> point.longitude() + "," + point.latitude())
                .reduce((left, right) -> left + ";" + right)
                .orElseThrow(() -> new IllegalArgumentException("OSRM map matching requires coordinates."));

        return UriComponentsBuilder
                .fromUriString(trimTrailingSlash(osrmBaseUrl) + "/match/v1/" + normalizedProfile() + "/" + coordinates)
                .queryParam("annotations", "false")
                .queryParam("geometries", "geojson")
                .build(true)
                .toUriString();
    }

    @SuppressWarnings("unchecked")
    private List<MatchedBreadcrumbPointDTO> parseMatchedBreadcrumbs(
            List<RawBreadcrumbPointDTO> rawBreadcrumbs,
            Map<String, Object> body
    ) {
        if (body == null) {
            throw new IllegalStateException("OSRM map matching returned an empty response. " + matchingSemanticsNote());
        }

        String code = body.get("code") instanceof String rawCode && !rawCode.isBlank()
                ? rawCode
                : "UNKNOWN";
        if (!"Ok".equals(code)) {
            throw new IllegalStateException("OSRM map matching failed with code " + code + ". " + matchingSemanticsNote());
        }

        Object rawTracepoints = body.get("tracepoints");
        if (!(rawTracepoints instanceof List<?> tracepoints) || tracepoints.size() != rawBreadcrumbs.size()) {
            throw new IllegalStateException(
                    "OSRM map matching returned " + describeTracepointCount(rawTracepoints)
                            + " tracepoints for " + rawBreadcrumbs.size() + " breadcrumbs."
            );
        }

        List<MatchedBreadcrumbPointDTO> matched = new ArrayList<>(tracepoints.size());
        for (int index = 0; index < tracepoints.size(); index++) {
            Object rawTracepoint = tracepoints.get(index);
            if (!(rawTracepoint instanceof Map<?, ?> tracepoint)) {
                throw new IllegalStateException(
                        "OSRM did not match breadcrumb " + index + ". " + matchingSemanticsNote()
                );
            }
            matched.add(parseTracepointLocation(index, tracepoint));
        }
        return List.copyOf(matched);
    }

    private MatchedBreadcrumbPointDTO parseTracepointLocation(int index, Map<?, ?> tracepoint) {
        Object rawLocation = tracepoint.get("location");
        if (!(rawLocation instanceof List<?> location) || location.size() < 2) {
            throw new IllegalStateException(
                    "OSRM returned no snapped location for breadcrumb " + index + ". " + matchingSemanticsNote()
            );
        }

        Object rawLongitude = location.get(0);
        Object rawLatitude = location.get(1);
        if (!(rawLongitude instanceof Number longitude) || !(rawLatitude instanceof Number latitude)) {
            throw new IllegalStateException(
                    "OSRM returned an invalid snapped location for breadcrumb " + index + ". " + matchingSemanticsNote()
            );
        }

        return new MatchedBreadcrumbPointDTO(latitude.doubleValue(), longitude.doubleValue());
    }

    private String normalizedProfile() {
        if (osrmProfile == null || osrmProfile.isBlank()) {
            return "driving";
        }
        return osrmProfile.trim();
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "https://router.project-osrm.org";
        }
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String describeTracepointCount(Object rawTracepoints) {
        if (rawTracepoints instanceof List<?> tracepoints) {
            return Integer.toString(tracepoints.size());
        }
        return "an invalid number of";
    }
}
