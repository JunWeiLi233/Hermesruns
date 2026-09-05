package com.hermes.backend.races;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

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

    @SuppressWarnings({"unchecked", "rawtypes"})
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
        if (context.contains("osaka")) {
            return localBounds(34.7010, 34.6450, 135.4720, 135.5430, "Osaka Marathon local route bounds");
        }
        if (context.contains("tokyo")) {
            return localBounds(35.7130, 35.6450, 139.6880, 139.8090, "Tokyo Marathon local route bounds");
        }
        if (context.contains("athens")) {
            return localBounds(38.1600, 37.9600, 23.7200, 24.0100, "Athens Marathon local route bounds");
        }
        if (context.contains("los angeles")) {
            return localBounds(34.1100, 34.0350, -118.4700, -118.2300, "Los Angeles Marathon local route bounds");
        }
        if (context.contains("auckland")) {
            return localBounds(-36.7700, -36.8900, 174.7400, 174.8700, "Auckland Marathon local route bounds");
        }
        if (context.contains("bangkok")) {
            return localBounds(13.7900, 13.7250, 100.4200, 100.5450, "Bangkok Marathon local route bounds");
        }
        if (context.contains("buenos aires")) {
            return localBounds(-34.5350, -34.6450, -58.3350, -58.5050, "Buenos Aires Marathon local route bounds");
        }
        if (context.contains("cape town")) {
            return localBounds(-33.8950, -33.9900, 18.3750, 18.5050, "Cape Town Marathon local route bounds");
        }
        if (context.contains("chengdu")) {
            return localBounds(30.7000, 30.5350, 103.9950, 104.1250, "Chengdu Marathon local route bounds");
        }
        if (context.contains("dalian")) {
            return localBounds(38.9550, 38.8750, 121.5600, 121.7000, "Dalian Marathon local route bounds");
        }
        if (context.contains("dublin")) {
            return localBounds(53.3740, 53.2960, -6.3650, -6.2050, "Dublin Marathon local route bounds");
        }
        if (context.contains("doha")) {
            return localBounds(25.3300, 25.2700, 51.5000, 51.5550, "Doha Marathon local route bounds");
        }
        if (context.contains("dubai")) {
            return localBounds(25.1900, 25.0900, 55.1450, 55.2350, "Dubai Marathon local route bounds");
        }
        if (context.contains("beijing")) {
            return localBounds(40.0350, 39.8950, 116.2850, 116.4250, "Beijing Marathon local route bounds");
        }
        if (context.contains("marine corps")) {
            return localBounds(38.9270, 38.8470, -77.0870, -77.0040, "Marine Corps Marathon local route bounds");
        }
        if (context.contains("brussels")) {
            return localBounds(50.9020, 50.8300, 4.3100, 4.4200, "Brussels Airport Marathon local route bounds");
        }
        if (context.contains("big sur")) {
            return localBounds(36.5550, 36.2350, -121.9400, -121.7600, "Big Sur Marathon local route bounds");
        }
        if (context.contains("boston")) {
            return localBounds(42.3700, 42.2050, -71.5450, -71.0350, "Boston Marathon local route bounds");
        }
        if (context.contains("gold coast")) {
            return localBounds(-27.8950, -28.1050, 153.3800, 153.4700, "Gold Coast Marathon local route bounds");
        }
        if (context.contains("fukuoka")) {
            return localBounds(33.6500, 33.5400, 130.1450, 130.4100, "Fukuoka Marathon local route bounds");
        }
        if (context.contains("guangzhou")) {
            return localBounds(23.1500, 23.0750, 113.2350, 113.3950, "Guangzhou Marathon local route bounds");
        }
        if (context.contains("hangzhou")) {
            return localBounds(30.2850, 30.1550, 120.0700, 120.2750, "Hangzhou Marathon local route bounds");
        }
        if (context.contains("helsinki")) {
            return localBounds(60.2350, 60.1450, 24.8200, 25.0800, "Helsinki Marathon local route bounds");
        }
        if (context.contains("ho chi minh")) {
            return localBounds(10.7950, 10.7350, 106.6150, 106.7650, "Ho Chi Minh City Marathon local route bounds");
        }
        if (context.contains("hong kong")) {
            return localBounds(22.3720, 22.2750, 114.0450, 114.2050, "Hong Kong Marathon local route bounds");
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
        if (context.contains("osaka")) {
            return resolveLocalOsakaAnchor(anchorLabel, anchor);
        }
        if (context.contains("tokyo")) {
            return resolveLocalTokyoAnchor(anchorLabel, anchor);
        }
        if (context.contains("athens")) {
            return resolveLocalAthensAnchor(anchorLabel, anchor);
        }
        if (context.contains("los angeles")) {
            return resolveLocalLosAngelesAnchor(anchorLabel, anchor);
        }
        if (context.contains("auckland")) {
            return resolveLocalAucklandAnchor(anchorLabel, anchor);
        }
        if (context.contains("bangkok")) {
            return resolveLocalBangkokAnchor(anchorLabel, anchor);
        }
        if (context.contains("buenos aires")) {
            return resolveLocalBuenosAiresAnchor(anchorLabel, anchor);
        }
        if (context.contains("cape town")) {
            return resolveLocalCapeTownAnchor(anchorLabel, anchor);
        }
        if (context.contains("chengdu")) {
            return resolveLocalChengduAnchor(anchorLabel, anchor);
        }
        if (context.contains("doha")) {
            return resolveLocalDohaAnchor(anchorLabel, anchor);
        }
        if (context.contains("beijing")) {
            return resolveLocalBeijingAnchor(anchorLabel, anchor);
        }
        if (context.contains("brussels")) {
            return resolveLocalBrusselsAnchor(anchorLabel, anchor);
        }
        if (context.contains("big sur")) {
            return resolveLocalBigSurAnchor(anchorLabel, anchor);
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

    private GeocodedAnchorPointDTO resolveLocalOsakaAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "osaka prefectural", "otemae")) {
            return localAnchor(originalLabel, 34.6861, 135.5205, "Osaka Prefectural Government Office, Osaka, Japan");
        }
        if (matchesAny(anchor, "finish", "osaka castle hall")) {
            return localAnchor(originalLabel, 34.6894, 135.5301, "Osaka Castle Hall, Osaka, Japan");
        }
        if (matchesAny(anchor, "osaka castle park", "osaka castle", "morinomiya")) {
            return localAnchor(originalLabel, 34.6888, 135.5262, "Osaka Castle Park, Osaka, Japan");
        }
        if (matchesAny(anchor, "osaka city hall", "city hall")) {
            return localAnchor(originalLabel, 34.6937, 135.5023, "Osaka City Hall, Osaka, Japan");
        }
        if (matchesAny(anchor, "nakanoshima", "nakanoshima park")) {
            return localAnchor(originalLabel, 34.6928, 135.5008, "Nakanoshima, Osaka, Japan");
        }
        if (matchesAny(anchor, "kyocera dome", "kujo")) {
            return localAnchor(originalLabel, 34.6694, 135.4762, "Kyocera Dome Osaka, Osaka, Japan");
        }
        if (matchesAny(anchor, "naniwasuji", "hanazonocho")) {
            return localAnchor(originalLabel, 34.6490, 135.4965, "Naniwasuji, Osaka, Japan");
        }
        if (matchesAny(anchor, "shinsekai", "tsutenkaku")) {
            return localAnchor(originalLabel, 34.6470, 135.5078, "Shinsekai, Osaka, Japan");
        }
        if (matchesAny(anchor, "tennoji")) {
            return localAnchor(originalLabel, 34.6465, 135.5135, "Tennoji, Osaka, Japan");
        }
        if (matchesAny(anchor, "shitenno", "shitennoji", "shitenno ji")) {
            return localAnchor(originalLabel, 34.6539, 135.5167, "Shitenno-ji Temple, Osaka, Japan");
        }
        if (matchesAny(anchor, "tsuruhashi")) {
            return localAnchor(originalLabel, 34.6660, 135.5310, "Tsuruhashi, Osaka, Japan");
        }
        if (matchesAny(anchor, "imazato")) {
            return localAnchor(originalLabel, 34.6688, 135.5390, "Imazato, Osaka, Japan");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalTokyoAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "metropolitan government", "shinjuku")) {
            return localAnchor(originalLabel, 35.6894, 139.6917, "Tokyo Metropolitan Government Building, Tokyo, Japan");
        }
        if (matchesAny(anchor, "ueno", "ueno hirokoji", "ueno-hirokoji")) {
            return localAnchor(originalLabel, 35.7077, 139.7729, "Ueno-hirokoji, Tokyo, Japan");
        }
        if (matchesAny(anchor, "asakusa", "kaminarimon")) {
            return localAnchor(originalLabel, 35.7108, 139.7964, "Kaminarimon Gate, Asakusa, Tokyo, Japan");
        }
        if (matchesAny(anchor, "nihombashi", "nihonbashi")) {
            return localAnchor(originalLabel, 35.6836, 139.7744, "Nihombashi, Tokyo, Japan");
        }
        if (matchesAny(anchor, "tomioka", "hachimangu", "monzen nakacho", "monzen-nakacho")) {
            return localAnchor(originalLabel, 35.6713, 139.7983, "Tomioka Hachimangu Shrine, Tokyo, Japan");
        }
        if (matchesAny(anchor, "tamachi", "shiba")) {
            return localAnchor(originalLabel, 35.6456, 139.7477, "Tamachi Station, Tokyo, Japan");
        }
        if (matchesAny(anchor, "ginza", "hibiya")) {
            return localAnchor(originalLabel, 35.6715, 139.7650, "Ginza, Tokyo, Japan");
        }
        if (matchesAny(anchor, "finish", "tokyo station", "marunouchi", "gyoko")) {
            return localAnchor(originalLabel, 35.6812, 139.7671, "Tokyo Station / Gyoko-dori Avenue, Tokyo, Japan");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalAthensAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "marathon", "marathonas")) {
            return localAnchor(originalLabel, 38.1530, 23.9620, "Marathonas, Attica, Greece");
        }
        if (matchesAny(anchor, "nea makri")) {
            return localAnchor(originalLabel, 38.0870, 23.9760, "Nea Makri, Attica, Greece");
        }
        if (matchesAny(anchor, "rafina")) {
            return localAnchor(originalLabel, 38.0180, 24.0050, "Rafina, Attica, Greece");
        }
        if (matchesAny(anchor, "pikermi")) {
            return localAnchor(originalLabel, 38.0010, 23.9400, "Pikermi, Attica, Greece");
        }
        if (matchesAny(anchor, "pallini")) {
            return localAnchor(originalLabel, 38.0050, 23.8830, "Pallini, Attica, Greece");
        }
        if (matchesAny(anchor, "chalandri", "cholargos", "mesogeion")) {
            return localAnchor(originalLabel, 38.0000, 23.8000, "Mesogeion Avenue, Athens, Greece");
        }
        if (matchesAny(anchor, "finish", "athens", "panathenaic", "stadium")) {
            return localAnchor(originalLabel, 37.9683, 23.7414, "Panathenaic Stadium, Athens, Greece");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalLosAngelesAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "dodger stadium", "chavez ravine")) {
            return localAnchor(originalLabel, 34.0739, -118.2400, "Dodger Stadium, Los Angeles, CA, United States");
        }
        if (matchesAny(anchor, "chinatown", "dragon gate")) {
            return localAnchor(originalLabel, 34.0636, -118.2387, "Chinatown Dragon Gate, Los Angeles, CA, United States");
        }
        if (matchesAny(anchor, "downtown", "city hall", "little tokyo")) {
            return localAnchor(originalLabel, 34.0537, -118.2431, "Los Angeles City Hall, Los Angeles, CA, United States");
        }
        if (matchesAny(anchor, "echo park")) {
            return localAnchor(originalLabel, 34.0745, -118.2606, "Echo Park Lake, Los Angeles, CA, United States");
        }
        if (matchesAny(anchor, "hollywood", "hollywood and vine", "hollywood walk of fame")) {
            return localAnchor(originalLabel, 34.1017, -118.3267, "Hollywood and Vine, Los Angeles, CA, United States");
        }
        if (matchesAny(anchor, "sunset strip", "chateau marmont")) {
            return localAnchor(originalLabel, 34.0893, -118.3893, "Sunset Strip, West Hollywood, CA, United States");
        }
        if (matchesAny(anchor, "beverly hills", "rodeo drive")) {
            return localAnchor(originalLabel, 34.0739, -118.4000, "Beverly Hills City Hall, Beverly Hills, CA, United States");
        }
        if (matchesAny(anchor, "bundy", "turnaround", "brentwood")) {
            return localAnchor(originalLabel, 34.0466, -118.4658, "Bundy Drive turnaround, Los Angeles, CA, United States");
        }
        if (matchesAny(anchor, "finish", "century city", "avenue of the stars")) {
            return localAnchor(originalLabel, 34.0597, -118.4177, "Century City finish, Los Angeles, CA, United States");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalAucklandAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "devonport", "king edward parade")) {
            return localAnchor(originalLabel, -36.8318, 174.7983, "King Edward Parade, Devonport, Auckland, New Zealand");
        }
        if (matchesAny(anchor, "takapuna")) {
            return localAnchor(originalLabel, -36.7876, 174.7720, "Takapuna, Auckland, New Zealand");
        }
        if (matchesAny(anchor, "smales farm", "busway")) {
            return localAnchor(originalLabel, -36.7862, 174.7522, "Smales Farm, Auckland, New Zealand");
        }
        if (matchesAny(anchor, "harbour bridge", "harbor bridge", "onewa")) {
            return localAnchor(originalLabel, -36.8172, 174.7452, "Auckland Harbour Bridge, Auckland, New Zealand");
        }
        if (matchesAny(anchor, "mission bay")) {
            return localAnchor(originalLabel, -36.8491, 174.8307, "Mission Bay, Auckland, New Zealand");
        }
        if (matchesAny(anchor, "st heliers", "saint heliers", "tamaki drive turn")) {
            return localAnchor(originalLabel, -36.8496, 174.8586, "St Heliers Bay, Auckland, New Zealand");
        }
        if (matchesAny(anchor, "finish", "victoria park", "fanshawe")) {
            return localAnchor(originalLabel, -36.8478, 174.7540, "Victoria Park, Auckland, New Zealand");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalBangkokAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "mbk", "mbk center", "siam")) {
            return localAnchor(originalLabel, 13.7445, 100.5291, "MBK Center, Bangkok, Thailand");
        }
        if (matchesAny(anchor, "victory monument", "ratchawithi")) {
            return localAnchor(originalLabel, 13.7649, 100.5383, "Victory Monument, Bangkok, Thailand");
        }
        if (matchesAny(anchor, "rama viii bridge", "rama 8 bridge", "rama viii", "rama 8")) {
            return localAnchor(originalLabel, 13.7683, 100.5009, "Rama VIII Bridge, Bangkok, Thailand");
        }
        if (matchesAny(anchor, "golden mountain", "wat saket")) {
            return localAnchor(originalLabel, 13.7537, 100.5068, "Golden Mountain, Bangkok, Thailand");
        }
        if (matchesAny(anchor, "democracy monument", "ratchadamnoen")) {
            return localAnchor(originalLabel, 13.7565, 100.5018, "Democracy Monument, Bangkok, Thailand");
        }
        if (matchesAny(anchor, "borommaratchachonnani", "taling chan", "supawanee village")) {
            return localAnchor(originalLabel, 13.7795, 100.4248, "Borommaratchachonnani Road, Bangkok, Thailand");
        }
        if (matchesAny(anchor, "finish", "sanam luang", "royal grand palace", "grand palace")) {
            return localAnchor(originalLabel, 13.7540, 100.4920, "Sanam Luang finish, Bangkok, Thailand");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalBuenosAiresAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "largada", "start", "llegada", "finish", "figueroa alcorta", "dorrego", "planetario")) {
            return localAnchor(originalLabel, -34.5683, -58.4160, "Avenida Figueroa Alcorta and Dorrego start/finish, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "ciudad universitaria", "universitaria")) {
            return localAnchor(originalLabel, -34.5417, -58.4444, "Ciudad Universitaria, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "river plate", "monumental")) {
            return localAnchor(originalLabel, -34.5453, -58.4498, "River Plate, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "recoleta", "cementerio")) {
            return localAnchor(originalLabel, -34.5875, -58.3933, "Cementerio de la Recoleta, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "obelisco", "teatro colon", "teatro colon")) {
            return localAnchor(originalLabel, -34.6037, -58.3816, "Obelisco, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "casa rosada", "plaza de mayo")) {
            return localAnchor(originalLabel, -34.6081, -58.3709, "Casa Rosada, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "boca juniors", "la boca", "bombonera")) {
            return localAnchor(originalLabel, -34.6356, -58.3647, "Boca Juniors, Buenos Aires, Argentina");
        }
        if (matchesAny(anchor, "puerto madero", "reserva", "fuente de las nereidas")) {
            return localAnchor(originalLabel, -34.6110, -58.3524, "Puerto Madero and Reserva Ecologica, Buenos Aires, Argentina");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalCapeTownAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "beach rd start", "beach road start", "start", "stadium start", "green point")) {
            return localAnchor(originalLabel, -33.9055, 18.4080, "Green Point start area, Cape Town, South Africa");
        }
        if (matchesAny(anchor, "finish", "finish line", "dhl stadium", "fritz sonnenberg")) {
            return localAnchor(originalLabel, -33.9046, 18.4103, "DHL Stadium finish area, Cape Town, South Africa");
        }
        if (matchesAny(anchor, "sea point", "beach rd", "beach road", "three anchor bay")) {
            return localAnchor(originalLabel, -33.9186, 18.3890, "Sea Point Beach Road, Cape Town, South Africa");
        }
        if (matchesAny(anchor, "salt river", "albert", "liesbeek parkway", "liesbeek park way")) {
            return localAnchor(originalLabel, -33.9274, 18.4620, "Salt River and Liesbeek Parkway, Cape Town, South Africa");
        }
        if (matchesAny(anchor, "woodstock", "nelson mandela blvd", "victoria")) {
            return localAnchor(originalLabel, -33.9308, 18.4475, "Woodstock, Cape Town, South Africa");
        }
        if (matchesAny(anchor, "rondebosch common", "rondebosch")) {
            return localAnchor(originalLabel, -33.9590, 18.4850, "Rondebosch Common, Cape Town, South Africa");
        }
        if (matchesAny(anchor, "newlands", "camp ground", "main road")) {
            return localAnchor(originalLabel, -33.9720, 18.4675, "Newlands, Cape Town, South Africa");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalChengduAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "jinsha site museum", "jinsha", "start")) {
            return localAnchor(originalLabel, 30.6826, 104.0110, "Jinsha Site Museum start, Chengdu, China");
        }
        if (matchesAny(anchor, "tianfu square", "tian fu square")) {
            return localAnchor(originalLabel, 30.6570, 104.0658, "Tianfu Square, Chengdu, China");
        }
        if (matchesAny(anchor, "sichuan university museum", "museum of sichuan university", "sichuan university", "half finish")) {
            return localAnchor(originalLabel, 30.6350, 104.0870, "Sichuan University Museum, Chengdu, China");
        }
        if (matchesAny(anchor, "century city finish", "century city", "new international convention", "exhibition center", "finish")) {
            return localAnchor(originalLabel, 30.5574, 104.0668, "Chengdu Century City New International Convention and Exhibition Center finish, Chengdu, China");
        }
        if (matchesAny(anchor, "tianfu avenue", "south turnaround", "huayang")) {
            return localAnchor(originalLabel, 30.5450, 104.0665, "Tianfu Avenue south course corridor, Chengdu, China");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalDohaAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "hotel park", "start", "finish")) {
            return localAnchor(originalLabel, 25.3190, 51.5305, "Hotel Park start/finish, Doha, Qatar");
        }
        if (matchesAny(anchor, "sheraton", "sheraton grand", "sheraton grand doha", "west bay")) {
            return localAnchor(originalLabel, 25.3182, 51.5360, "Sheraton Grand Doha Resort, West Bay, Doha, Qatar");
        }
        if (matchesAny(anchor, "al bidda", "al bidda park", "bidda")) {
            return localAnchor(originalLabel, 25.2898, 51.5107, "Al Bidda Park, Doha, Qatar");
        }
        if (matchesAny(anchor, "corniche", "al corniche", "al corniche st")) {
            return localAnchor(originalLabel, 25.2965, 51.5335, "Al Corniche Street, Doha, Qatar");
        }
        if (matchesAny(anchor, "doha port", "mina", "old doha port")) {
            return localAnchor(originalLabel, 25.2915, 51.5454, "Doha Port, Doha, Qatar");
        }
        if (matchesAny(anchor, "al dafna", "al dafna park", "dafna")) {
            return localAnchor(originalLabel, 25.3145, 51.5262, "Al Dafna Park, Doha, Qatar");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalBeijingAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "tiananmen", "tian an men", "tian'anmen", "dongchang an", "east side road")) {
            return localAnchor(originalLabel, 39.9042, 116.3975, "Tiananmen Square start, Beijing, China");
        }
        if (matchesAny(anchor, "fuxingmen", "xidan", "chang an", "chang'an avenue")) {
            return localAnchor(originalLabel, 39.9073, 116.3568, "Chang'an Avenue, Beijing, China");
        }
        if (matchesAny(anchor, "cctv tower", "central radio", "television tower", "yuyuantan")) {
            return localAnchor(originalLabel, 39.9185, 116.3003, "CCTV Tower, Beijing, China");
        }
        if (matchesAny(anchor, "national library", "zizhuyuan")) {
            return localAnchor(originalLabel, 39.9432, 116.3254, "National Library, Beijing, China");
        }
        if (matchesAny(anchor, "zhongguancun", "haidian")) {
            return localAnchor(originalLabel, 39.9837, 116.3163, "Zhongguancun, Beijing, China");
        }
        if (matchesAny(anchor, "national speed skating", "ice ribbon", "speed skating oval")) {
            return localAnchor(originalLabel, 40.0169, 116.3835, "National Speed Skating Oval, Beijing, China");
        }
        if (matchesAny(anchor, "bird's nest", "birds nest", "national stadium")) {
            return localAnchor(originalLabel, 39.9929, 116.3965, "National Stadium, Beijing, China");
        }
        if (matchesAny(anchor, "olympic park", "olympic forest", "olympic east road")) {
            return localAnchor(originalLabel, 40.0066, 116.3957, "Olympic Park, Beijing, China");
        }
        if (matchesAny(anchor, "finish", "central landscape", "landscape avenue", "aoti", "olympic sports center")) {
            return localAnchor(originalLabel, 40.0036, 116.3917, "Central Landscape Avenue finish, Olympic Park, Beijing, China");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalBrusselsAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "place de brouckere", "de brouckere", "brouckere", "brouckereplein")) {
            return localAnchor(originalLabel, 50.8512, 4.3529, "Place de Brouckere start, Brussels, Belgium");
        }
        if (matchesAny(anchor, "cinquantenaire", "jubelpark", "parc du cinquantenaire")) {
            return localAnchor(originalLabel, 50.8419, 4.3905, "Parc du Cinquantenaire, Brussels, Belgium");
        }
        if (matchesAny(anchor, "atomium")) {
            return localAnchor(originalLabel, 50.8949, 4.3415, "Atomium, Brussels, Belgium");
        }
        if (matchesAny(anchor, "king baudouin stadium", "king baudouin", "baudouin stadium")) {
            return localAnchor(originalLabel, 50.8956, 4.3344, "King Baudouin Stadium, Brussels, Belgium");
        }
        if (matchesAny(anchor, "montgomery", "montgomery square", "square montgomery")) {
            return localAnchor(originalLabel, 50.8374, 4.4065, "Montgomery Square, Brussels, Belgium");
        }
        if (matchesAny(anchor, "koekelberg", "national basilica", "sacred heart")) {
            return localAnchor(originalLabel, 50.8673, 4.3178, "National Basilica of the Sacred Heart, Koekelberg, Belgium");
        }
        if (matchesAny(anchor, "josaphat", "josaphat park")) {
            return localAnchor(originalLabel, 50.8589, 4.3852, "Josaphat Park, Brussels, Belgium");
        }
        if (matchesAny(anchor, "kapucijnenbos", "kapucijnen bos", "capuchin forest", "arboretum tervuren")) {
            return localAnchor(originalLabel, 50.8130, 4.5140, "Kapucijnenbos, Tervuren, Belgium");
        }
        if (matchesAny(anchor, "tervuren", "tervueren")) {
            return localAnchor(originalLabel, 50.8237, 4.5142, "Tervuren, Belgium");
        }
        if (matchesAny(anchor, "halfwaypoint half marathon", "halfway point half marathon", "woluwe park", "parc de woluwe")) {
            return localAnchor(originalLabel, 50.8297, 4.4325, "Parc de Woluwe, Brussels, Belgium");
        }
        if (matchesAny(anchor, "bois de la cambre", "ter kamerenbos", "cambre")) {
            return localAnchor(originalLabel, 50.8040, 4.3790, "Bois de la Cambre, Brussels, Belgium");
        }
        if (matchesAny(anchor, "finish", "place des palais", "paleizenplein", "royal palace", "palais")) {
            return localAnchor(originalLabel, 50.8425, 4.3593, "Place des Palais finish, Brussels, Belgium");
        }
        return null;
    }

    private GeocodedAnchorPointDTO resolveLocalBigSurAnchor(String originalLabel, String anchor) {
        if (matchesAny(anchor, "start", "big sur station")) {
            return localAnchor(originalLabel, 36.2447, -121.7799, "Big Sur Station, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "big sur village", "big sur")) {
            return localAnchor(originalLabel, 36.2704, -121.8081, "Big Sur Village, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "andrew molera", "21 miler start")) {
            return localAnchor(originalLabel, 36.2850, -121.8431, "Andrew Molera State Park, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "point sur")) {
            return localAnchor(originalLabel, 36.3121, -121.8950, "Point Sur, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "little sur river")) {
            return localAnchor(originalLabel, 36.3293, -121.8948, "Little Sur River Bridge, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "hurricane point")) {
            return localAnchor(originalLabel, 36.3538, -121.9023, "Hurricane Point, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "bixby bridge", "bixby creek")) {
            return localAnchor(originalLabel, 36.3717, -121.9026, "Bixby Bridge, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "grimes ranch", "11 miler start")) {
            return localAnchor(originalLabel, 36.3940, -121.9106, "Grimes Ranch, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "garrapata bridge", "garrapata")) {
            return localAnchor(originalLabel, 36.4261, -121.9160, "Garrapata Bridge, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "sobranes point", "soberanes point")) {
            return localAnchor(originalLabel, 36.4547, -121.9275, "Soberanes Point, Big Sur, CA, United States");
        }
        if (matchesAny(anchor, "yankee point")) {
            return localAnchor(originalLabel, 36.5000, -121.9390, "Yankee Point, Carmel Highlands, CA, United States");
        }
        if (matchesAny(anchor, "point lobos")) {
            return localAnchor(originalLabel, 36.5166, -121.9433, "Point Lobos, Carmel, CA, United States");
        }
        if (matchesAny(anchor, "finish", "rio road", "highway 1", "carmel")) {
            return localAnchor(originalLabel, 36.5383, -121.9084, "Rio Road finish, Carmel, CA, United States");
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
