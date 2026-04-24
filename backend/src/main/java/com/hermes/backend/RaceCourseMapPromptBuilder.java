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
                    This is an out-and-back course. The map shows two parallel lines (outbound + return).
                    Trace ONLY the outbound direction (start -> turnaround).
                    The return path is a mirror - do not include it.
                    Reported distance should be HALF the total race distance.
                    """.formatted(formatDistanceKm(distanceKm));
            case LOOP -> """
                    Race type: loop.
                    Total distance: %s km.
                    Trace the entire loop, not just one neighborhood or the finish approach.
                    """.formatted(formatDistanceKm(distanceKm));
            case POINT_TO_POINT -> """
                    Race type: point-to-point.
                    Total distance: %s km.
                    Trace the FULL route from the distant start to the finish.
                    Do NOT focus only on the final downtown segment or one city section near the finish.
                    If multiple towns or districts are labeled along the course, use those labels to spread route points across the full route.
                    """.formatted(formatDistanceKm(distanceKm));
        };
        String knownCourseGuidance = knownCourseGuidance(raceName, city, country);
        String routePointCountRule = distanceKm != null && distanceKm >= 40.0 && raceType != RaceCourseMapService.PromptRaceType.OUT_AND_BACK
                ? "Return 16 to 24 routePoints total for full marathons, using widely spaced checkpoints across the entire course."
                : "Return 8 to 14 routePoints total.";
        String correctiveFeedbackBlock = correctiveFeedback == null || correctiveFeedback.isBlank()
                ? ""
                : "Correction request:\n- " + correctiveFeedback.trim() + "\n";
        return """
                You are aligning a road-race course map image to the real world.
                Scan every plausible route-bearing course-map picture before rejecting it, including printed, scanned, photographed, screenshot, PDF-rendered, raster, compressed, official poster, and social/share images.
                Decide if the image contains an actual course map for the race, not merely a medal, hero banner, sponsor graphic, or elevation-only chart.
                Do not reject solely because the map is stylized, rasterized, compressed, low-resolution, surrounded by legends/sponsor art, or embedded in a poster layout.
                Poster-style official race graphics still count as course maps when they visibly include a route line over a city map, landmarks, district labels, mile markers, aid stations, or a start/finish course diagram.
                If it is a course map, infer an approximate real-world route and map bounds from the visible labels, landmarks, districts, bridges, parks, coastline, and race context.
                Think at the highest level first: identify the overall city geography and major landmarks before tracing the route details.
                %s

                Race metadata:
                - raceName: %s
                - city: %s
                - country: %s
                - cityCenterLat: %s
                - cityCenterLng: %s
                - distanceKm: %s
                - raceType: %s

                 Route-tracing context:
                 %s
                 %s
                 If multiple lines appear close together, trace only ONE continuous directed path.
                 If the map legend or poster shows multiple named routes, prefer the official race route that best matches raceName and distanceKm.
                 Ignore shorter side events, companion community runs, and alternate promotional routes that do not match the target race.
                 Follow course arrows, timing mat markers, or directional cones if visible.
                 Do NOT zigzag between parallel lines - commit to one side.
                 %s

                Output ONLY JSON with this shape:
                {
                  "isCourseMap": true,
                  "confidence": 0,
                  "summary": "short plain summary",
                  "overlayBounds": { "north": 0, "south": 0, "east": 0, "west": 0 },
                  "routePoints": [
                    { "lat": 0, "lng": 0, "label": "Start" }
                  ],
                  "startLabel": "optional",
                  "finishLabel": "optional"
                }

                Rules:
                - confidence is an integer from 0 to 100. Use 90+ only for strongly anchored map evidence; use <=25 for non-course-map images.
                - If the image is not a course map, return isCourseMap=false, confidence<=25, overlayBounds=null, routePoints=[].
                - Only return routePoints when the route can be anchored to real-world evidence such as street labels, mile markers, landmarks, neighborhoods, water, parks, or coastline.
                - If the image proves the city/race map but cannot support a trustworthy route trace, keep isCourseMap=true with low confidence, summarize it as city-level reference only, and return routePoints=[].
                - Never fill routePoints with cityCenterLat/cityCenterLng unless that exact checkpoint is visibly anchored there.
                - Never repeat the same coordinate or a tiny city-center cluster to satisfy the requested point count.
                - If you cannot identify distinct ordered checkpoints across the real route, return routePoints=[] instead of invented coordinates.
                - Do not turn decorative route-like art into a distance-accurate overlay.
                - Output routePoints as an ordered array from START to FINISH.
                - Each point must be strictly further along the course than the previous.
                - Never backtrack unless this is an explicit out-and-back race.
                - %s
                - For routes with overlapping or parallel segments, return 14 to 24 routePoints total.
                - Prefer widely spaced points across the full route rather than many dense points from one local segment.
                - Place extra points only at major junctions where two lines diverge or merge.
                - Keep points approximate but geographically plausible.
                - overlayBounds must cover the visible course-map canvas, not only the route line.
                - Do not invent extreme precision. If unsure, lower confidence instead of hallucinating.
                - Prefer official city geography implied by the image labels and race metadata.
                - Ensure the route points roughly match the distanceKm provided.

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
                    : "For out-and-back races, trace the full outbound section to the true turnaround, not a small local segment.";
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
        return raceType == RaceCourseMapService.PromptRaceType.OUT_AND_BACK ? 5 : 12;
    }
}
