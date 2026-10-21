package com.hermes.backend.activity.analysis;

import com.garmin.fit.*;
import com.hermes.backend.imports.FitActivityFileParser;
import com.hermes.backend.imports.TcxActivityFileParser;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.assertThat;

class SessionAnalysisSourceParserTests {
    @TempDir Path scratch;
    @Test void fitKeepsOriginalLapBoundariesTimerDistanceAndUnknownIntensityRatherThanAlternating() throws Exception {
        Path fixture = scratch.resolve("original-laps.fit");
        FileEncoder encoder = new FileEncoder(fixture.toFile(), Fit.ProtocolVersion.V2_0);
        Instant start = Instant.parse("2026-10-11T10:00:00Z");
        try {
            for (int i = 0; i <= 60; i++) {
                RecordMesg record = new RecordMesg(); record.setTimestamp(new DateTime(java.util.Date.from(start.plusSeconds(i))));
                record.setPositionLat(485808100); record.setPositionLong(-882854400); record.setDistance((float)i * 5);
                encoder.write(record);
            }
            for (int i = 0; i < 2; i++) {
                LapMesg lap = new LapMesg(); lap.setStartTime(new DateTime(java.util.Date.from(start.plusSeconds(i * 30))));
                lap.setTimestamp(new DateTime(java.util.Date.from(start.plusSeconds((i + 1) * 30))));
                lap.setTotalElapsedTime(30f); lap.setTotalTimerTime(20f); lap.setTotalDistance(150f); lap.setSport(Sport.RUNNING);
                encoder.write(lap);
            }
            SessionMesg session = new SessionMesg(); session.setStartTime(new DateTime(java.util.Date.from(start)));
            session.setTimestamp(new DateTime(java.util.Date.from(start.plusSeconds(60)))); session.setSport(Sport.RUNNING);
            session.setAvgHeartRate((short)150); session.setMaxHeartRate((short)160);
            session.setTotalDistance(300f); session.setTotalTimerTime(40f); encoder.write(session);
        } finally { encoder.close(); }
        var parsed = new FitActivityFileParser().parse("original-laps.fit", Files.readAllBytes(fixture));
        assertThat(parsed.durationSeconds()).isEqualTo(40);
        assertThat(parsed.distanceMeters()).isEqualTo(300);
        assertThat(parsed.sourceLaps()).hasSize(2);
        var first = parsed.sourceLaps().get(0);
        assertThat(first.kind()).isEqualTo("unknown"); assertThat(first.startSeconds()).isZero(); assertThat(first.endSeconds()).isEqualTo(30);
        assertThat(first.durationSeconds()).isEqualTo(20); assertThat(first.distanceMeters()).isEqualTo(150);
        assertThat(parsed.sourceLaps().get(1).startSeconds()).isEqualTo(30);
    }
    @Test void fitWithoutAnyHrImportsWithNullSummaryHeartRate() throws Exception {
        Path fixture = scratch.resolve("no-hr.fit");
        FileEncoder encoder = new FileEncoder(fixture.toFile(), Fit.ProtocolVersion.V2_0);
        Instant start = Instant.parse("2026-10-11T10:00:00Z");
        try {
            for (int i = 0; i < 2; i++) {
                RecordMesg record = new RecordMesg(); record.setTimestamp(new DateTime(java.util.Date.from(start.plusSeconds(i * 20))));
                record.setPositionLat(485808100); record.setPositionLong(-882854400); record.setDistance((float)i * 100);
                encoder.write(record);
            }
            SessionMesg session = new SessionMesg(); session.setStartTime(new DateTime(java.util.Date.from(start))); session.setSport(Sport.RUNNING);
            session.setTotalDistance(100f); session.setTotalTimerTime(20f); encoder.write(session);
        } finally { encoder.close(); }
        byte[] bytes = Files.readAllBytes(fixture);
        org.assertj.core.api.Assertions.assertThatCode(() -> new FitActivityFileParser().parse("no-hr.fit", bytes)).doesNotThrowAnyException();
        var parsed = new FitActivityFileParser().parse("no-hr.fit", bytes);
        assertThat(parsed.averageHeartRate()).isNull(); assertThat(parsed.maxHeartRate()).isNull();
    }
    @Test void nestedIntensityDoesNotClassifyALapAndMissingBoundsStayMissing() {
        String xml = """
            <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities>
            <Activity Sport="Running"><Id>2026-10-11T10:00:00Z</Id><Lap>
            <TotalTimeSeconds>10</TotalTimeSeconds><DistanceMeters>50</DistanceMeters>
            <Extensions><Intensity>Active</Intensity></Extensions><Track><Trackpoint>
            <Position><LatitudeDegrees>40</LatitudeDegrees><LongitudeDegrees>-74</LongitudeDegrees></Position>
            </Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>
            """;
        var parsed = new TcxActivityFileParser().parse("unknown.tcx", xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(parsed.sourceLaps()).hasSize(1); var lap = parsed.sourceLaps().get(0);
        assertThat(lap.kind()).isEqualTo("unknown"); assertThat(lap.startSeconds()).isNull(); assertThat(lap.endSeconds()).isNull();
        assertThat(lap.durationSeconds()).isEqualTo(10);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"Active,work", "Resting,recovery", "Rest,unknown", "Other,unknown", "MISSING,unknown"})
    void onlyAgreedDirectChildTcxLabelsClassifyOriginalLaps(String intensity, String expected) {
        String xml = "<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"><Activities>"
                + "<Activity Sport=\"Running\"><Id>2026-10-11T10:00:00Z</Id><Lap StartTime=\"2026-10-11T10:00:00Z\">"
                + "<TotalTimeSeconds>10</TotalTimeSeconds><DistanceMeters>50</DistanceMeters>"
                + ("MISSING".equals(intensity) ? "" : "<Intensity>" + intensity + "</Intensity>")
                + "<Track><Trackpoint><Time>2026-10-11T10:00:10Z</Time><Position><LatitudeDegrees>40</LatitudeDegrees>"
                + "<LongitudeDegrees>-74</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>";
        var parsed = new TcxActivityFileParser().parse("whitelist.tcx", xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var lap = parsed.sourceLaps().get(0);
        assertThat(lap.kind()).isEqualTo(expected);
        assertThat(lap.label()).isEqualTo("MISSING".equals(intensity) ? null : intensity);
        assertThat(lap.durationSeconds()).isEqualTo(10); assertThat(lap.distanceMeters()).isEqualTo(50);
        assertThat(lap.startSeconds()).isZero(); assertThat(lap.endSeconds()).isEqualTo(10);
    }
}
