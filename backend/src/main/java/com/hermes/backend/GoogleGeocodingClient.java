package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class GoogleGeocodingClient {
    private final RestTemplate restTemplate;

    @Value("${app.google.geocoding.api-key:${APP_GOOGLE_GEOCODING_API_KEY:}}")
    private String apiKey = "";

    @Value("${app.google.geocoding.url:https://maps.googleapis.com/maps/api/geocode/json}")
    private String geocodingUrl = "https://maps.googleapis.com/maps/api/geocode/json";

    public GoogleGeocodingClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<GeocodedAnchorPointDTO> geocodeAnchorPoints(
            String raceName,
            String city,
            String country,
            List<String> anchorLabels
    ) {
        validateRequiredText("raceName", raceName);
        validateRequiredText("city", city);
        validateRequiredText("country", country);
        validateAnchorLabels(anchorLabels);
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Google geocoding API key is not configured.");
        }

        List<GeocodedAnchorPointDTO> geocodedPoints = new ArrayList<>(4);
        for (String anchorLabel : anchorLabels) {
            String normalizedLabel = anchorLabel.trim();
            String query = buildQuery(normalizedLabel, raceName.trim(), city.trim(), country.trim());
            String url = UriComponentsBuilder.fromUriString(geocodingUrl)
                    .queryParam("address", query)
                    .queryParam("key", apiKey)
                    .build()
                    .encode()
                    .toUriString();

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    Map.class
            );
            geocodedPoints.add(parseResponse(normalizedLabel, query, response.getBody()));
        }
        return List.copyOf(geocodedPoints);
    }

    private void validateRequiredText(String fieldName, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
    }

    private void validateAnchorLabels(List<String> anchorLabels) {
        if (anchorLabels == null || anchorLabels.size() != 4) {
            throw new IllegalArgumentException("Google geocoding requires exactly 4 anchor labels.");
        }
        for (String anchorLabel : anchorLabels) {
            if (anchorLabel == null || anchorLabel.isBlank()) {
                throw new IllegalArgumentException("Anchor labels must be non-blank.");
            }
        }
    }

    private String buildQuery(String anchorLabel, String raceName, String city, String country) {
        return String.join(", ", anchorLabel, raceName, city, country);
    }

    @SuppressWarnings("unchecked")
    private GeocodedAnchorPointDTO parseResponse(String anchorLabel, String query, Map<String, Object> body) {
        if (body == null) {
            throw new IllegalStateException("Google geocoding returned an empty response for anchor '" + anchorLabel + "'.");
        }

        String status = body.get("status") instanceof String rawStatus && !rawStatus.isBlank()
                ? rawStatus
                : "UNKNOWN";
        if (!"OK".equals(status)) {
            throw new IllegalStateException(
                    "Google geocoding failed for anchor '" + anchorLabel + "' with status " + status + ". Query: " + query
            );
        }

        Object rawResults = body.get("results");
        if (!(rawResults instanceof List<?> results) || results.isEmpty()) {
            throw new IllegalStateException(
                    "Google geocoding returned no results for anchor '" + anchorLabel + "'. Query: " + query
            );
        }
        if (!(results.get(0) instanceof Map<?, ?> firstResult)) {
            throw new IllegalStateException(
                    "Google geocoding returned an invalid top result for anchor '" + anchorLabel + "'."
            );
        }

        Object rawFormattedAddress = firstResult.get("formatted_address");
        if (!(rawFormattedAddress instanceof String formattedAddress) || formattedAddress.isBlank()) {
            throw new IllegalStateException(
                    "Google geocoding returned no formatted address for anchor '" + anchorLabel + "'."
            );
        }

        Object rawGeometry = firstResult.get("geometry");
        if (!(rawGeometry instanceof Map<?, ?> geometry)) {
            throw new IllegalStateException(
                    "Google geocoding returned no geometry for anchor '" + anchorLabel + "'."
            );
        }

        Object rawLocation = geometry.get("location");
        if (!(rawLocation instanceof Map<?, ?> location)) {
            throw new IllegalStateException(
                    "Google geocoding returned no location for anchor '" + anchorLabel + "'."
            );
        }

        Object rawLat = location.get("lat");
        Object rawLng = location.get("lng");
        if (!(rawLat instanceof Number lat) || !(rawLng instanceof Number lng)) {
            throw new IllegalStateException(
                    "Google geocoding returned invalid coordinates for anchor '" + anchorLabel + "'."
            );
        }

        return new GeocodedAnchorPointDTO(anchorLabel, lat.doubleValue(), lng.doubleValue(), formattedAddress.trim());
    }
}
