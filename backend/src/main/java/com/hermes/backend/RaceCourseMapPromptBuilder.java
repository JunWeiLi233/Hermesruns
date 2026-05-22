package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class RaceCourseMapPromptBuilder {

    public String buildAlignmentPrompt(
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            boolean forceRouteExtraction,
            RaceCourseMapService.PromptRaceType raceType,
            String correctiveFeedback
    ) {
        String locationContext = """
                Race location: %s, %s.
                Approximate race-area coordinates: %s, %s.
                Key landmarks near course: city center, main roads, bridges, parks, waterfront if applicable.
                %s
                """.formatted(
                safePromptValue(city),
                safePromptValue(country),
                latitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", latitude),
                longitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", longitude),
                forceRouteExtraction
                        ? "You must identify the race route even if the course map is stylized, partially visible, or embedded in a poster layout."
                        : "Prefer official course geometry over decorative page art whenever both appear."
        );
        String raceTypeInstructions = switch (raceType) {
            case OUT_AND_BACK -> """
                    Race type: out-and-back.
                    Total distance: %s km.
                    Trace the full outbound leg, the turnaround point, and the return leg.
                    When the return lane is visibly separate from the outbound (different side of a divided road, parallel path, or a labeled split), trace both sides with distinct checkpoints.
                    When the return exactly overlaps the outbound line, represent the shared corridor once in race order without duplicating points.
                    Reported route distance must match the full target race distance, not half.
                    """.formatted(formatDistanceKm(distanceKm));
            case LOOP -> """
                    Race type: loop.
                    Total distance: %s km.
                    Trace the entire loop from start to finish, covering the full circuit.
                    Do not trace only one neighborhood or the finish approach.
                    """.formatted(formatDistanceKm(distanceKm));
            case POINT_TO_POINT -> """
                    Race type: point-to-point.
                    Total distance: %s km.
                    Trace the FULL route from the distant start location to the finish.
                    Do NOT focus only on the final downtown segment or one city section near the finish.
                    If multiple towns or districts are labeled along the course, spread route points across the entire labeled corridor.
                    """.formatted(formatDistanceKm(distanceKm));
        };
        String knownCourseGuidance = knownCourseGuidance(raceName, city, country);
        String routePointCountRule = distanceKm != null && distanceKm >= 40.0
                ? "Your route should contain 16 to 24 routePoints, widely spaced across the full marathon distance."
                : "Your route should contain 8 to 14 routePoints, spread across the full course.";
        String correctiveFeedbackBlock = correctiveFeedback == null || correctiveFeedback.isBlank()
                ? ""
                : "\nCORRECTION FROM PREVIOUS ATTEMPT:\n" + correctiveFeedback.trim() + "\nAddress the correction above before producing your final output.\n";
        return """
                You are a computer vision assistant for road-race course map analysis. Your single task is to examine the uploaded image and return a structured JSON alignment.

                WORK THROUGH THESE THREE STAGES IN ORDER. If you classify the image as NOT a course map at Stage 1, stop immediately and return the rejection — do not proceed to later stages.

                ========================================================================
                STAGE 1 — CLASSIFY: Is this a course map?
                ========================================================================

                A course map contains a VISIBLE ROUTE LINE drawn over a GEOGRAPHIC MAP area. Supporting evidence includes: street names, road/highway numbers, district or neighborhood labels, park names, bridge labels, coastlines, rivers, mile or kilometer markers, aid stations, and start/finish markers.

                ACCEPT AS A COURSE MAP (even when the image quality is imperfect):
                - Printed course maps, photographed maps, screenshots
                - PDF-rendered maps, raster/compressed map images
                - Poster-style official race graphics that include a map layer with a route line overlaid, even when surrounded by sponsor art, legends, or decorative borders
                - Stylized or simplified route diagrams over a recognizable street/geographic grid

                REJECT ONLY WHEN the image contains NO map layer at all:
                - Medal photos, finisher-shirt graphics, hero banners
                - Sponsor-only graphics with no underlying map
                - Elevation/profile charts that have no geographic map underneath
                - Generic city skyline photos without any route line or map grid

                If NOT a course map: return isCourseMap=false, confidence<=25, overlayBounds=null, routePoints=[], summary="not a course map — [brief reason]". STOP. Do not continue.

                ========================================================================
                STAGE 2 — GEOREFERENCE: Locate the map in real-world coordinates
                ========================================================================

                %s

                Race metadata:
                - raceName: %s
                - city: %s
                - country: %s
                - cityCenterLat: %s
                - cityCenterLng: %s
                - distanceKm: %s
                - raceType: %s

                COORDINATE EXTRACTION — use these methods in order of reliability:

                1. BEST — MAP AXIS LABELS AND TICK MARKS:
                   Look closely at the edges of the map image for printed latitude and longitude labels or numbered tick marks. These appear as small numbers (e.g., "42.30" along the top or bottom edge, "71.15" along the left or right edge). READ THESE NUMBERS DIRECTLY. They are your most trustworthy coordinate source. If you see axis labels, use them to establish overlayBounds and to place route points.

                2. GOOD — VISIBLE LANDMARKS WITH KNOWN LOCATIONS:
                   Identify specific street names, highway numbers, named bridges, parks, neighborhood labels, or waterfront features visible on the map. Match each to its known real-world location using the race metadata above. Cross-reference AT LEAST 2-3 widely separated features before producing confident coordinates.

                3. LAST RESORT — CITY-CENTER APPROXIMATION:
                   Use the cityCenterLat/cityCenterLng above as a rough anchor ONLY when you can see visible evidence that the map covers that city. NEVER copy cityCenterLat/cityCenterLng as a route point unless a visible landmark is verifiably at that exact coordinate. NEVER cluster multiple route points at or near the city center just to satisfy a point count.

                OVERLAY BOUNDS:
                overlayBounds must cover the ENTIRE visible map canvas (not only the route line). Derive bounds from: visible axis labels, the outermost roads or district edges shown on the map, or the most distant labeled landmarks. Include generous padding so the route sits comfortably inside the bounds. ALWAYS ensure north > south and east > west.

                CRITICAL HONESTY CHECK: If you can identify only features clustered in one small area and cannot confidently place the map in real-world coordinates, set confidence <=40 and return routePoints=[]. A partial answer that admits uncertainty is better than a fabricated answer.

                ========================================================================
                STAGE 3 — TRACE: Extract ordered route points
                ========================================================================

                %s

                COURSE GEOGRAPHY REFERENCE (sanity check only — do NOT use as a substitute for reading the image):
                %s

                The reference above describes what the real-world course looks like. Use it ONLY to cross-check and validate what you SEE in the image. If your visual evidence contradicts the reference, trust what you see. If the image is too unclear to match against the reference, return routePoints=[] with low confidence.

                Follow the highlighted route line from START to FINISH in race order. Place route points at: major turns, road junctions, bridge or river crossings, visible mile/km markers, neighborhood transitions, and labeled landmarks.

                Spread points EVENLY across the FULL course length. For point-to-point races, the first point must be near the distant start — do not cluster all points in the downtown finish area. For loop races, trace the entire circuit. For out-and-back races, capture the full outbound leg, the true turnaround, and the return leg.

                Do NOT zigzag between parallel route lines. Follow the side with visible course arrows, timing mats, or directional markers. The course arrows, timing mat markers, or directional cones visible in the image are authoritative — follow them. Ignore side events, relay variants, and promotional routes that do not match the target race name and distance. If the map legend or poster shows multiple named routes, choose the one that best matches raceName and distanceKm.

                %s

                HONESTY RULE: If you cannot identify distinct, ordered checkpoints across the full visible route, return routePoints=[] with isCourseMap=true and low confidence (<=40). An honest empty route is BETTER than a fabricated route with invented coordinates. Never fill routePoints with cityCenterLat/cityCenterLng or cluster points in one neighborhood to satisfy the requested point count.

                ========================================================================
                FEW-SHOT REFERENCE EXAMPLE
                ========================================================================

                Below is a correct, high-quality output for a point-to-point marathon. Study its STRUCTURE and LEVEL OF DETAIL. YOUR output must follow this same format but use data derived from YOUR specific image — do NOT copy these coordinates.

                {
                  "isCourseMap": true,
                  "confidence": 92,
                  "summary": "Point-to-point course from suburban start to urban finish. Route traced from visible solid line on street map with town labels, highway numbers, and mile markers anchoring each checkpoint.",
                  "overlayBounds": { "north": 42.38, "south": 42.22, "east": -71.04, "west": -71.58 },
                  "routePoints": [
                    { "lat": 42.228, "lng": -71.523, "label": "Start — Hopkinton" },
                    { "lat": 42.261, "lng": -71.464, "label": "Ashland" },
                    { "lat": 42.280, "lng": -71.417, "label": "Framingham" },
                    { "lat": 42.296, "lng": -71.351, "label": "Natick Center" },
                    { "lat": 42.308, "lng": -71.280, "label": "Wellesley" },
                    { "lat": 42.329, "lng": -71.207, "label": "Newton — Heartbreak Hill" },
                    { "lat": 42.339, "lng": -71.154, "label": "Brookline — Beacon St" },
                    { "lat": 42.349, "lng": -71.080, "label": "Finish — Copley Square" }
                  ],
                  "startLabel": "Hopkinton",
                  "finishLabel": "Copley Square"
                }

                KEY QUALITIES TO NOTICE AND EMULATE:
                - Every route point has REAL GPS coordinates (not 0.0, not repeated values).
                - Route points are in strict start-to-finish order with EVEN spacing across the full ~42 km.
                - overlayBounds cover all route points PLUS generous padding around the map canvas.
                - Each point label references a VISIBLE landmark that would be labeled on the map.
                - Confidence is 92 because visible labels anchor every point.
                - When the image is UNCLEAR, confidence should be LOWER and routePoints may be empty.

                ========================================================================
                OUTPUT JSON FORMAT
                ========================================================================

                Return ONLY the JSON object below with no markdown code fences, no explanatory text before or after:

                {
                  "isCourseMap": true,
                  "confidence": 0,
                  "summary": "one-sentence plain description of what the image shows",
                  "overlayBounds": { "north": 0, "south": 0, "east": 0, "west": 0 },
                  "routePoints": [
                    { "lat": 0, "lng": 0, "label": "Start" }
                  ],
                  "startLabel": "optional landmark name at start",
                  "finishLabel": "optional landmark name at finish"
                }

                CONFIDENCE GUIDE:
                - 90-100: Strongly anchored — you found visible axis labels, street names, or landmarks confirming every route point.
                - 65-89: Reasonably anchored — you can identify the city area and trace approximate checkpoints from visible roads/districts.
                - 40-64: Tentative — you can see it is a course map but the specific route trace is approximate.
                - 25-39: Map present but unclear — you can confirm the image is a course map but cannot trace the route at all (return routePoints=[]).
                - 0-24: Not a course map (return isCourseMap=false, overlayBounds=null, routePoints=[]).

                ========================================================================
                SELF-VERIFICATION — Run these checks BEFORE returning your final JSON
                ========================================================================

                Silently verify the following before output:
                1. ALL routePoint.lat values fall between overlayBounds.south and overlayBounds.north.
                2. ALL routePoint.lng values fall between overlayBounds.west and overlayBounds.east.
                3. Route points are in strict race order from start to finish with NO backtracking.
                4. %s
                5. Every coordinate is anchored to a VISIBLE feature in the image, not guessed from race memory.
                6. No two consecutive route points share the same coordinate values.
                7. If uncertain about any point, you lowered confidence instead of fabricating.

                """.formatted(
                locationContext,
                safePromptValue(raceName),
                safePromptValue(city),
                safePromptValue(country),
                latitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", latitude),
                longitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", longitude),
                distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm),
                raceType.promptValue(),
                raceTypeInstructions,
                knownCourseGuidance,
                correctiveFeedbackBlock,
                routePointCountRule
        );
    }

    public String knownCourseGuidance(String raceName, String city, String country) {
        String combined = String.join(" ", safePromptValue(raceName), safePromptValue(city), safePromptValue(country)).toLowerCase(Locale.ROOT);
        if (combined.contains("boston marathon")) {
            return "Known Boston Marathon corridor: trace west-to-east from Hopkinton through Ashland, Framingham, Natick, Wellesley, Newton, Brookline, and into Boston/Copley. Do NOT focus only on the final downtown Boston segment.";
        }
        if (combined.contains("chicago marathon") || combined.contains("bank of america chicago marathon")) {
            return "Known Chicago Marathon corridor: start/finish in Grant Park, then spread points north through River North, Lincoln Park, Lakeview/Sheridan, back through Old Town and the Loop, west toward Greektown/United Center, south through Pilsen, Chinatown, Bridgeport, Bronzeville, and north on Michigan/Indiana to Grant Park. Do NOT reuse the Chicago city center as every checkpoint.";
        }
        if ((combined.contains("new york") || combined.contains("nyc")) && combined.contains("marathon")) {
            return "Known New York City Marathon corridor: start on Staten Island near the Verrazzano-Narrows Bridge, cross into Brooklyn, continue through Queens and the Queensboro Bridge, then First Avenue, the Bronx, Fifth Avenue, and finish in Central Park. Do NOT place route checkpoints in New York Harbor, the Atlantic Ocean, or open water; bridge crossings may touch water only at the visible bridge corridor.";
        }
        return "";
    }

    public String buildPlausibilityRescuePrompt(
            RaceCourseMapGeometryService.AlignmentPlausibilityVerdict plausibilityVerdict,
            RaceCourseMapService.PromptRaceType raceType,
            Double distanceKm
    ) {
        String distanceHint = distanceKm == null ? "the target race" : String.format(Locale.ROOT, "%.1f km", distanceKm);
        String routeShapeHint = raceType == RaceCourseMapService.PromptRaceType.POINT_TO_POINT
                ? "For point-to-point marathons, do not trace only the downtown finish area or one city segment. Trace the full route from the distant start location to the finish."
                : raceType == RaceCourseMapService.PromptRaceType.LOOP
                    ? "For loop races, trace the entire loop, not just one neighborhood or the finish approach."
                    : "For out-and-back races, trace the full outbound section, the true turnaround, and the return section when it is visible. Do not collapse the answer to only the outbound half.";
        return """
                The previous route hypothesis failed plausibility checks: %s
                %s
                Re-read the full map canvas, including distant towns, mile markers, start labels, and the full highlighted route line.
                The returned route should cover the full %s route, not a short local fragment.
                Do not reuse the city center, start, or finish coordinate as filler points. If the map cannot support distinct real-world checkpoints across the full route, return routePoints=[] with low confidence instead of a collapsed route.
                """.formatted(plausibilityVerdict.reason(), routeShapeHint, distanceHint).trim();
    }

    public String formatDistanceKm(Double distanceKm) {
        return distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm);
    }

    public String safePromptValue(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
    }

    public int minimumRoutePointCountForRescue(RaceCourseMapService.PromptRaceType raceType) {
        return 12;
    }
}
