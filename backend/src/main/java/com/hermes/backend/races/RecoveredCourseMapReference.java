package com.hermes.backend.races;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Organizer source identities and ordered coordinates recovered together, with edition provenance. */
final class RecoveredCourseMapReference {
    private static final List<Entry> ENTRIES=load();
    private RecoveredCourseMapReference() { }

    static Optional<VerifiedCourseMap> match(String hash,String raceName,String city,String country,Double distanceKm) {
        if(distanceKm==null || !Double.isFinite(distanceKm) || Math.abs(distanceKm-42.195)>=0.05) return Optional.empty();
        return ENTRIES.stream().filter(e -> e.hashes().contains(hash) && normalize(e.raceName()).equals(normalize(raceName))
                && normalize(e.city()).equals(normalize(city)) && normalize(e.country()).equals(normalize(country))
                && e.routePoints()!=null && e.routePoints().size()>1)
            .findFirst().map(e -> new VerifiedCourseMap(
                ("source-reviewed".equals(e.alignmentMethod())?"reviewed-source-map:":"verified-official-map:")+e.raceId(),
                ("source-reviewed".equals(e.alignmentMethod())
                    ? "Source-aligned review draft, edition "+e.edition()+". Geographic route checked against the exact official map and ordered landmarks; this is a derived or independently checked track requiring review, not organizer-authored GPS. "
                    : "Recovered organizer course, edition "+e.edition()+". Exact source content matches the original ordered organizer coordinates; the source image is retained for reference. ")+
                (e.interpretation()==null?"":e.interpretation()),
                e.geometrySourceUrl()==null?e.sourceUrl():e.geometrySourceUrl(),e.routePoints(),List.of(),null));
    }

    static boolean recognizes(String hash) {
        // Retain rejected guide-cover identities so removing an erroneous page
        // binding cannot re-enable the older race-name-only upload shortcut.
        return !hash.isEmpty() && ENTRIES.stream().anyMatch(e -> e.hashes().contains(hash)
                || (e.rejectedHashes()!=null && e.rejectedHashes().contains(hash)));
    }
    private static String normalize(String s) { return s==null?"":s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]",""); }
    private static List<Entry> load() {
        try(var stream=RecoveredCourseMapReference.class.getResourceAsStream("/races/recovered-official-course-sources.json")) {
            if(stream==null) throw new IllegalStateException("Recovered source catalog missing");
            return List.copyOf(new ObjectMapper().readValue(stream,new TypeReference<List<Entry>>(){}));
        } catch(Exception e) { throw new ExceptionInInitializerError(e); }
    }
    record Entry(String raceId,String raceName,String city,String country,String edition,String sourceUrl,
                 String sourceSha256,String geometrySourceUrl,String interpretation,List<String> hashes,List<RoutePoint> routePoints,
                 String alignmentMethod,List<String> rejectedHashes) { }
}
