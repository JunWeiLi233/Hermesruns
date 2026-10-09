package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityType;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GpxActivityFileParserTests {

    private final GpxActivityFileParser parser = new GpxActivityFileParser();

    private static final String TWO_POINTS = """
            <trkseg>
              <trkpt lat="31.230400" lon="121.470000"><ele>5.0</ele><time>2026-07-01T07:00:00</time></trkpt>
              <trkpt lat="31.230800" lon="121.470400"><ele>5.2</ele><time>2026-07-01T07:00:20</time></trkpt>
            </trkseg>
            """;

    private ParsedActivityData parse(String gpxBody, String fileName) {
        String xml = "<?xml version=\"1.0\"?><gpx version=\"1.1\" creator=\"test\">"
                + gpxBody + "</gpx>";
        return parser.parse(fileName, xml.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void explicitTrackTypeRunningResolvesRun() {
        ParsedActivityData data = parse(
                "<trk><name>Morning Run</name><type>Running</type>" + TWO_POINTS + "</trk>",
                "export.gpx");
        assertEquals(ActivityType.RUN, data.activityType());
    }

    @Test
    void runTrackNameWithoutTypeResolvesRun() {
        ParsedActivityData data = parse(
                "<trk><name>Morning Run</name>" + TWO_POINTS + "</trk>",
                "export.gpx");
        assertEquals(ActivityType.RUN, data.activityType());
    }

    @Test
    void runTokenInFileNameResolvesRunWhenTrackNameAbsent() {
        ParsedActivityData data = parse(
                "<trk>" + TWO_POINTS + "</trk>",
                "easy_run.gpx");
        assertEquals(ActivityType.RUN, data.activityType());
    }

    @Test
    void specificNonRunTrackNameVetoesFileNameRunToken() {
        // Matches ActivityTypeResolver semantics (type -> name -> filename):
        // a concrete non-run label resolves NON_RUN before later labels are read.
        ParsedActivityData data = parse(
                "<trk><name>Garmin Export</name>" + TWO_POINTS + "</trk>",
                "easy_run.gpx");
        assertEquals(ActivityType.NON_RUN, data.activityType());
    }

    @Test
    void rideTypeResolvesNonRun() {
        ParsedActivityData data = parse(
                "<trk><name>Commute</name><type>Ride</type>" + TWO_POINTS + "</trk>",
                "export.gpx");
        assertEquals(ActivityType.NON_RUN, data.activityType());
    }

    @Test
    void genericTrackNameWithNonRunFileNameIsSkippedAsNonRun() {
        ParsedActivityData data = parse(
                "<trk><name>Workout</name>" + TWO_POINTS + "</trk>",
                "activity.gpx");
        assertEquals(ActivityType.NON_RUN, data.activityType());
    }

    @Test
    void trackPointsAreParsedWithTelemetry() {
        ParsedActivityData data = parse(
                "<trk><name>Morning Run</name>" + TWO_POINTS + "</trk>",
                "export.gpx");
        assertEquals(2, data.points().size());
        assertEquals(31.230400d, data.points().get(0).latitude(), 1e-9);
        assertEquals(121.470400d, data.points().get(1).longitude(), 1e-9);
        assertEquals(5.2d, data.points().get(1).elevationMeters(), 1e-9);
        assertEquals(20, data.points().get(1).elapsedSeconds());
        assertFalse(data.points().isEmpty());
    }

    @Test
    void trackPointsCarryCumulativeDistanceEndingAtActivityDistance() {
        ParsedActivityData data = parse("""
                <trk><name>Morning Run</name><trkseg>
                  <trkpt lat="31.230000" lon="121.470000"><time>2026-07-01T07:00:00</time></trkpt>
                  <trkpt lat="31.231000" lon="121.470000"><time>2026-07-01T07:00:30</time></trkpt>
                  <trkpt lat="31.232000" lon="121.470000"><time>2026-07-01T07:01:00</time></trkpt>
                </trkseg></trk>
                """, "export.gpx");

        assertEquals(0d, data.points().get(0).distanceMeters(), 1e-9);
        // 0.001 degrees of latitude is about 111.2 m.
        assertEquals(111.2d, data.points().get(1).distanceMeters(), 0.1);
        assertEquals(2 * data.points().get(1).distanceMeters(), data.points().get(2).distanceMeters(), 0.01);
        assertEquals(data.distanceMeters(), data.points().get(2).distanceMeters(), 0.5);
    }
}
