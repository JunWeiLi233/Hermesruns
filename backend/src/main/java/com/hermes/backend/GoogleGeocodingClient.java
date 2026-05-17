package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class GoogleGeocodingClient {
    private static final Duration GEOCODING_CACHE_TTL = Duration.ofDays(30);
    private static final int MIN_ANCHOR_POINTS = 4;
    private static final int MAX_ANCHOR_POINTS = 10;

    private final RestTemplate restTemplate;
    private final TtlCacheStore cacheStore;

    @Value("${app.google.geocoding.api-key:${APP_GOOGLE_GEOCODING_API_KEY:}}")
    private String apiKey = "";

    @Value("${app.google.geocoding.url:https://maps.googleapis.com/maps/api/geocode/json}")
    private String geocodingUrl = "https://maps.googleapis.com/maps/api/geocode/json";

    @Autowired
    public GoogleGeocodingClient(RestTemplate restTemplate, TtlCacheStore cacheStore) {
        this.restTemplate = restTemplate;
        this.cacheStore = cacheStore;
    }

    public GoogleGeocodingClient(RestTemplate restTemplate) {
        this(restTemplate, TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public boolean hasLocalAnchorCatalog() {
        return true;
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
        List<GeocodedAnchorPointDTO> localAnchors = geocodeLocalAnchorPoints(raceName, city, country, anchorLabels);
        if (localAnchors.size() == anchorLabels.size()) {
            return localAnchors;
        }
        if (!isConfigured()) {
            throw new IllegalStateException("Google geocoding API key is not configured and local anchors did not cover every requested anchor.");
        }

        List<GeocodedAnchorPointDTO> geocodedPoints = new ArrayList<>(anchorLabels.size());
        for (String anchorLabel : anchorLabels) {
            String normalizedLabel = anchorLabel.trim();
            String query = buildQuery(normalizedLabel, raceName.trim(), city.trim(), country.trim());
            GeocodedAnchorPointDTO cached = cacheStore.get("google-geocoding", query, GeocodedAnchorPointDTO.class).orElse(null);
            if (cached != null) {
                geocodedPoints.add(cached);
                continue;
            }
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
            GeocodedAnchorPointDTO parsed = parseResponse(normalizedLabel, query, response.getBody());
            cacheStore.put("google-geocoding", query, parsed, GEOCODING_CACHE_TTL);
            geocodedPoints.add(parsed);
        }
        return List.copyOf(geocodedPoints);
    }

    public List<GeocodedAnchorPointDTO> localRouteBoundsAnchors(String raceName, String city, String country) {
        String context = normalizeKey(String.join(" ", raceName, city, country));
        if (context.contains("munich") || context.contains("munchen") || context.contains("muenchen")) {
            return localBounds(48.1900, 48.1050, 11.5050, 11.6400, "Munich Marathon local route bounds");
        }
        if (context.contains("paris")) {
            return localBounds(48.8950, 48.8150, 2.2500, 2.4700, "Paris Marathon local route bounds");
        }
        if (context.contains("chicago")) {
            return localBounds(41.9900, 41.7650, -87.7200, -87.5900, "Chicago Marathon local route bounds");
        }
        if (context.contains("new york")) {
            return localBounds(40.8600, 40.5800, -74.0800, -73.9200, "New York City Marathon local route bounds");
        }
        if (context.contains("boston")) {
            return localBounds(42.3700, 42.2050, -71.5450, -71.0350, "Boston Marathon local route bounds");
        }
        if (context.contains("gold coast")) {
            return localBounds(-27.8950, -28.1050, 153.3800, 153.4700, "Gold Coast Marathon local route bounds");
        }
        return List.of();
    }

    private void validateRequiredText(String fieldName, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
    }

    private void validateAnchorLabels(List<String> anchorLabels) {
        if (anchorLabels == null || anchorLabels.size() < MIN_ANCHOR_POINTS || anchorLabels.size() > MAX_ANCHOR_POINTS) {
            throw new IllegalArgumentException("Google geocoding requires between 4 and 10 anchor labels.");
        }
        for (String anchorLabel : anchorLabels) {
            if (anchorLabel == null || anchorLabel.isBlank()) {
                throw new IllegalArgumentException("Anchor labels must be non-blank.");
            }
        }
    }

    private String buildQuery(String anchorLabel, String raceName, String city, String country) {
        String knownRaceQuery = buildKnownRaceQuery(anchorLabel, raceName, city, country);
        if (knownRaceQuery != null && !knownRaceQuery.isBlank()) {
            return knownRaceQuery;
        }
        return String.join(", ", anchorLabel, raceName, city, country);
    }

    private String buildKnownRaceQuery(String anchorLabel, String raceName, String city, String country) {
        String context = normalizeKey(String.join(" ", raceName, city, country));
        String anchor = normalizeKey(anchorLabel);
        if (context.contains("boston")) {
            if (matchesAny(anchor, "start", "hopkinton")) {
                return "Boston Marathon start line, Hopkinton, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "ashland")) {
                return "Ashland, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "framingham")) {
                return "Framingham, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "natick")) {
                return "Natick, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "wellesley")) {
                return "Wellesley, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "newton", "heartbreak")) {
                return "Newton, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "brookline")) {
                return "Brookline, Massachusetts, " + country;
            }
            if (matchesAny(anchor, "finish", "boylston", "copley")) {
                return "Boston Marathon finish line, Boylston Street, Boston, Massachusetts, " + country;
            }
        }
        return null;
    }

    private List<GeocodedAnchorPointDTO> geocodeLocalAnchorPoints(
            String raceName,
            String city,
            String country,
            List<String> anchorLabels
    ) {
        List<GeocodedAnchorPointDTO> points = new ArrayList<>(anchorLabels.size());
        for (String anchorLabel : anchorLabels) {
            GeocodedAnchorPointDTO point = resolveLocalAnchor(raceName, city, country, anchorLabel);
            if (point == null) {
                return List.of();
            }
            points.add(point);
        }
        return List.copyOf(points);
    }

    private GeocodedAnchorPointDTO resolveLocalAnchor(String raceName, String city, String country, String anchorLabel) {
        String context = normalizeKey(String.join(" ", raceName, city, country));
        String anchor = normalizeKey(anchorLabel);
        if (context.contains("munich") || context.contains("munchen") || context.contains("muenchen")) {
            return resolveLocalMunichAnchor(anchorLabel, anchor);
        }
        if (context.contains("paris")) {
            return resolveLocalParisAnchor(anchorLabel, anchor);
        }
        if (context.contains("chicago")) {
            return resolveLocalChicagoAnchor(anchorLabel, anchor);
        }
        if (context.contains("new york")) {
            return resolveLocalNewYorkAnchor(anchorLabel, anchor);
        }
        if (context.contains("boston")) {
            return resolveLocalBostonAnchor(anchorLabel, anchor);
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalMunichAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "finish", "ziel", "olympiapark", "olympic park", "olympiastadion")) {
            return localAnchor(originalLabel, 48.1755, 11.5518, "Olympiapark, Munich, Germany");
        }
        if (matchesAny(anchor, "siegestor", "victory gate")) {
            return localAnchor(originalLabel, 48.1510, 11.5821, "Siegestor, Munich, Germany");
        }
        if (matchesAny(anchor, "englischer garten", "english garden")) {
            return localAnchor(originalLabel, 48.1606, 11.6030, "Englischer Garten, Munich, Germany");
        }
        if (matchesAny(anchor, "marienplatz")) {
            return localAnchor(originalLabel, 48.1372, 11.5755, "Marienplatz, Munich, Germany");
        }
        if (matchesAny(anchor, "odeonsplatz")) {
            return localAnchor(originalLabel, 48.1428, 11.5773, "Odeonsplatz, Munich, Germany");
        }
        if (matchesAny(anchor, "isartor")) {
            return localAnchor(originalLabel, 48.1346, 11.5821, "Isartor, Munich, Germany");
        }
        if (matchesAny(anchor, "deutsches museum")) {
            return localAnchor(originalLabel, 48.1303, 11.5845, "Deutsches Museum, Munich, Germany");
        }
        if (matchesAny(anchor, "sendlinger tor")) {
            return localAnchor(originalLabel, 48.1335, 11.5677, "Sendlinger Tor, Munich, Germany");
        }
        if (matchesAny(anchor, "werksviertel", "werkviertel")) {
            return localAnchor(originalLabel, 48.1243, 11.6064, "Werksviertel, Munich, Germany");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalParisAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "champs elysees", "arc de triomphe")) {
            return localAnchor(originalLabel, 48.8698, 2.3076, "Champs-Elysees, Paris, France");
        }
        if (matchesAny(anchor, "place de la concorde", "concorde")) {
            return localAnchor(originalLabel, 48.8656, 2.3212, "Place de la Concorde, Paris, France");
        }
        if (matchesAny(anchor, "hotel de ville", "city hall")) {
            return localAnchor(originalLabel, 48.8566, 2.3522, "Hotel de Ville, Paris, France");
        }
        if (matchesAny(anchor, "bois de vincennes", "vincennes")) {
            return localAnchor(originalLabel, 48.8315, 2.4350, "Bois de Vincennes, Paris, France");
        }
        if (matchesAny(anchor, "bastille")) {
            return localAnchor(originalLabel, 48.8532, 2.3691, "Place de la Bastille, Paris, France");
        }
        if (matchesAny(anchor, "finish", "avenue foch", "foch")) {
            return localAnchor(originalLabel, 48.8738, 2.2833, "Avenue Foch, Paris, France");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalChicagoAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "finish", "grant park")) {
            return localAnchor(originalLabel, 41.8789, -87.6190, "Grant Park, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "river north")) {
            return localAnchor(originalLabel, 41.8925, -87.6341, "River North, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "magnificent mile", "michigan avenue")) {
            return localAnchor(originalLabel, 41.8948, -87.6242, "Magnificent Mile, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "lincoln park")) {
            return localAnchor(originalLabel, 41.9214, -87.6513, "Lincoln Park, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "wrigleyville", "wrigley field")) {
            return localAnchor(originalLabel, 41.9472, -87.6560, "Wrigleyville, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "lakeview", "sheridan")) {
            return localAnchor(originalLabel, 41.9400, -87.6537, "Lakeview, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "old town")) {
            return localAnchor(originalLabel, 41.9110, -87.6377, "Old Town, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "west loop", "greektown", "united center")) {
            return localAnchor(originalLabel, 41.8807, -87.6668, "West Loop, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "chinatown")) {
            return localAnchor(originalLabel, 41.8526, -87.6334, "Chinatown, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "pilsen")) {
            return localAnchor(originalLabel, 41.8562, -87.6566, "Pilsen, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "bridgeport")) {
            return localAnchor(originalLabel, 41.8369, -87.6476, "Bridgeport, Chicago, IL, United States");
        }
        if (matchesAny(anchor, "bronzeville")) {
            return localAnchor(originalLabel, 41.8240, -87.6250, "Bronzeville, Chicago, IL, United States");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalNewYorkAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "staten island", "verrazzano", "verrazano")) {
            return localAnchor(originalLabel, 40.6036, -74.0566, "Verrazzano-Narrows Bridge, Staten Island, NY, United States");
        }
        if (matchesAny(anchor, "brooklyn", "fourth avenue", "4th avenue", "bay ridge", "williamsburg")) {
            return localAnchor(originalLabel, 40.6782, -73.9442, "Brooklyn, NY, United States");
        }
        if (matchesAny(anchor, "queens", "long island city")) {
            return localAnchor(originalLabel, 40.7447, -73.9485, "Long Island City, Queens, NY, United States");
        }
        if (matchesAny(anchor, "queensboro", "queensboro bridge", "ed koch bridge")) {
            return localAnchor(originalLabel, 40.7567, -73.9548, "Queensboro Bridge, New York, NY, United States");
        }
        if (matchesAny(anchor, "first avenue", "1st avenue")) {
            return localAnchor(originalLabel, 40.7769, -73.9507, "First Avenue, New York, NY, United States");
        }
        if (matchesAny(anchor, "bronx", "willis avenue", "madison avenue bridge")) {
            return localAnchor(originalLabel, 40.8088, -73.9299, "The Bronx, NY, United States");
        }
        if (matchesAny(anchor, "fifth avenue", "5th avenue", "harlem")) {
            return localAnchor(originalLabel, 40.8010, -73.9500, "Fifth Avenue, New York, NY, United States");
        }
        if (matchesAny(anchor, "finish", "central park", "columbus circle")) {
            return localAnchor(originalLabel, 40.7711, -73.9742, "Central Park, New York, NY, United States");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalBostonAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "hopkinton")) {
            return localAnchor(originalLabel, 42.2295, -71.5218, "Boston Marathon start line, Hopkinton, MA, United States");
        }
        if (matchesAny(anchor, "ashland")) {
            return localAnchor(originalLabel, 42.2612, -71.4634, "Ashland, MA, United States");
        }
        if (matchesAny(anchor, "framingham")) {
            return localAnchor(originalLabel, 42.2793, -71.4162, "Framingham, MA, United States");
        }
        if (matchesAny(anchor, "natick")) {
            return localAnchor(originalLabel, 42.2834, -71.3495, "Natick, MA, United States");
        }
        if (matchesAny(anchor, "wellesley")) {
            return localAnchor(originalLabel, 42.2965, -71.2926, "Wellesley, MA, United States");
        }
        if (matchesAny(anchor, "heartbreak", "newton")) {
            return localAnchor(originalLabel, 42.3389, -71.2092, "Newton Hills, Newton, MA, United States");
        }
        if (matchesAny(anchor, "brookline")) {
            return localAnchor(originalLabel, 42.3318, -71.1212, "Brookline, MA, United States");
        }
        if (matchesAny(anchor, "finish", "boylston", "copley")) {
            return localAnchor(originalLabel, 42.3499, -71.0784, "Boston Marathon finish, Boylston Street, Boston, MA, United States");
        }
        return null;
    }

    private GeocodedAnchorPointDTO localAnchor(String label, double latitude, double longitude, String formattedAddress) {
        return new GeocodedAnchorPointDTO(label, latitude, longitude, formattedAddress);
    }

    private List<GeocodedAnchorPointDTO> localBounds(double north, double south, double west, double east, String label) {
        return List.of(
                localAnchor(label + " northwest", north, west, label),
                localAnchor(label + " northeast", north, east, label),
                localAnchor(label + " southeast", south, east, label),
                localAnchor(label + " southwest", south, west, label)
        );
    }

    private boolean matchesAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(normalizeKey(candidate))) {
                return true;
            }
        }
        return false;
    }

    private String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return ascii.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
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
