package com.hermes.backend.activity.analysis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.*;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SessionIntervalDetectionTests {
    final ActivityRepository activities = mock(ActivityRepository.class);
    final ActivityPointRepository points = mock(ActivityPointRepository.class);
    final Runner owner = new Runner("detection@hermes.test", "ACTIVE");
    final Activity activity = new Activity();
    final SessionAnalysisService service = new SessionAnalysisService(activities, points,
        mock(SessionAnalysisActivityRepository.class), new ObjectMapper(), Clock.systemUTC());

    List<Object[]> stream(int[] durations, double[] speeds) {
        var rows = new ArrayList<Object[]>(); int t = 0; double distance = 0;
        rows.add(new Object[]{null, null, 0, 0d, null, 130, 170});
        for (int block = 0; block < durations.length; block++) for (int i = 0; i < durations[block]; i++) {
            t++; distance += speeds[block];
            rows.add(new Object[]{null, null, t, distance, null, speeds[block] > 3 ? 165 : 140, 170});
        }
        return rows;
    }
    Map<String, Object> read(List<Object[]> rows) {
        activity.setActivityType(ActivityType.RUN); activity.setDurationSeconds((long)(int)rows.get(rows.size()-1)[2]);
        activity.setDistanceMeters((double)rows.get(rows.size()-1)[3]);
        when(activities.findByIdAndRunner(42L, owner)).thenReturn(Optional.of(activity));
        when(points.findAnalyticsSamplesByActivityIdOrdered(activity.getId())).thenReturn(rows);
        return service.read(42L, owner);
    }
    @SuppressWarnings("unchecked") List<SessionAnalysisService.Segment> segments(Map<String,Object> state) {
        return (List<SessionAnalysisService.Segment>)state.get("segments");
    }
    @Test void detectsRepeatedEffortsWithMeasuredBoundariesWithoutSavingDeclarations() {
        var state = read(stream(new int[]{300,180,90,180,90,180,300}, new double[]{2.4,3.8,2.2,3.8,2.2,3.8,2.4}));
        var rows = segments(state);
        assertThat(rows).extracting(SessionAnalysisService.Segment::kind)
            .containsExactly("warmup","work","recovery","work","recovery","work","cooldown");
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.provenance()).isEqualTo("auto-detected");
            assertThat(row.measurements().distanceMeters()).isPositive();
            assertThat(row.measurements().averageHeartRate()).isPositive();
        });
        assertThat(rows.stream().mapToDouble(r -> r.measurements().distanceMeters()).sum()).isEqualTo(activity.getDistanceMeters());
        assertThat(activity.getSessionAnalysisDeclarationsJson()).isNull();
        verify(activities, never()).saveAndFlush(any());
    }
    @Test void detectsSustainedFasterFinishButDoesNotInventRecovery() {
        assertThat(segments(read(stream(new int[]{1200,300},new double[]{2.6,3.2}))))
            .extracting(SessionAnalysisService.Segment::kind).containsExactly("warmup","work");
    }
    @Test void steadyRunsShortRunsAndStopsDoNotCreateWork() {
        for (var input : List.of(stream(new int[]{1800},new double[]{2.6}),
                stream(new int[]{60},new double[]{3.8}),
                stream(new int[]{300,60,300,60,300},new double[]{2.6,0,2.6,0,2.6}),
                stream(new int[]{900,20,900},new double[]{2.6,5,2.6}))) {
            assertThat(segments(read(input))).noneMatch(row -> row.kind().equals("work"));
        }
    }
    @Test void runnerDeclarationsAndExplicitImportedLabelsTakePrecedence() {
        var input=stream(new int[]{300,180,90,180,300},new double[]{2.4,3.8,2.2,3.8,2.4});
        activity.setSessionAnalysisDeclarationsJson("{\"segments\":[],\"comparison\":{}}");
        assertThat(segments(read(input))).isEmpty();
        activity.setSessionAnalysisDeclarationsJson(null);
        activity.setSourceImportedLapsJson(SessionAnalysisSources.encode(List.of(
            new SessionAnalysisSources.Lap("lap", "recovery",0,1050,1050d,3000d,null))));
        assertThat(segments(read(input))).extracting(SessionAnalysisService.Segment::provenance).containsExactly("imported");
    }
    @Test void unlabelledAutoLapsAllowDetectionWhileSourceLapsRemainUnchanged() {
        String source=SessionAnalysisSources.encode(List.of(new SessionAnalysisSources.Lap("auto-lap","unknown",0,1500,1500d,4080d,null)));
        activity.setSourceImportedLapsJson(source);
        assertThat(segments(read(stream(new int[]{1200,300},new double[]{2.6,3.2}))))
            .extracting(SessionAnalysisService.Segment::kind).containsExactly("warmup","work");
        assertThat(activity.getSourceImportedLapsJson()).isEqualTo(source);
    }
    @Test void resetsAndSparseSamplesStayUnknown() {
        var sparse = stream(new int[]{1200,300},new double[]{2.6,3.2});
        assertThat(segments(read(List.of(sparse.get(0),sparse.get(1200),sparse.get(1500)))))
            .noneMatch(row -> row.kind().equals("work"));
        sparse.get(800)[3] = 0d;
        assertThat(segments(read(sparse))).noneMatch(row -> row.kind().equals("work"));
    }
    @Test void missingTelemetryAndStationaryGapsBetweenEffortsRemainUnknown() {
        var input=stream(new int[]{300,180,80,180,300},new double[]{2.4,3.8,0,3.8,2.4});
        assertThat(segments(read(input))).anyMatch(row -> row.kind().equals("unknown"));
        var missing=new ArrayList<>(stream(new int[]{300,180,80,180,300},new double[]{2.4,3.8,2.2,3.8,2.4}));
        missing.removeIf(row -> (int)row[2]>480 && (int)row[2]<560);
        assertThat(segments(read(missing))).anyMatch(row -> row.kind().equals("unknown")
            && row.startSeconds() <= 480 && row.endSeconds() >= 560);
    }
    @Test void missingHeartRateDoesNotPreventPaceDetectionOrInventHr() {
        var input=stream(new int[]{1200,300},new double[]{2.6,3.2});
        input.forEach(row -> row[5]=null);
        assertThat(segments(read(input))).anyMatch(row -> row.kind().equals("work"))
            .allSatisfy(row -> {
                assertThat(row.measurements().averageHeartRate()).isNull();
                assertThat(row.measurements().hrCoverageSeconds()).isZero();
            });
    }
    @Test void tinyTrailingFragmentIsNotDeclaredACooldown() {
        assertThat(segments(read(stream(new int[]{1200,300,1},new double[]{2.6,3.2,2.4}))))
            .extracting(SessionAnalysisService.Segment::kind).containsExactly("warmup","work","unknown");
    }
    @Test void shallowPaceDipWithSteadyHeartRateDoesNotSplitOneEffort() {
        // A sustained faster finish with a shallow dip below the exit cutoff, like run #1921.
        var input=stream(new int[]{1200,140,80,160},new double[]{2.6,3.1,2.84,3.3});
        input.forEach(row -> row[5]=(int)row[2]<1200?150:170);
        assertThat(segments(read(input))).extracting(SessionAnalysisService.Segment::kind)
            .containsExactly("warmup","work");
    }
    @Test void shortThresholdDipDoesNotTruncateHrSupportedEffort() {
        // The faster section precedes a short dip below the exit threshold, like run #1912.
        var input=stream(new int[]{1200,80,20,60,460,180,300},new double[]{2.5,2.9,2.73,2.92,2.3,3.8,2.4});
        // Only the last 20 seconds of the first effort crosses the higher entry threshold.
        for(var row:input) {
            int t=(int)row[2];
            if(t>1340) row[3]=(double)row[3]+.38*Math.min(20,t-1340);
            row[5]=t>=1200 && t<=1360?168:145;
        }
        var work=segments(read(input)).stream().filter(row->row.kind().equals("work")).toList();
        assertThat(work).hasSize(2);
        assertThat(work.get(0).startSeconds()).isEqualTo(1200);
        assertThat(work.get(0).endSeconds()).isEqualTo(1360);
    }
    @Test void clearPaceRecoveryRemainsRecoveryEvenIfHeartRateStaysHigh() {
        var input=stream(new int[]{300,180,80,180,300},new double[]{2.4,3.8,2.2,3.8,2.4});
        input.forEach(row -> row[5]=170);
        assertThat(segments(read(input))).extracting(SessionAnalysisService.Segment::kind)
            .containsExactly("warmup","work","recovery","work","cooldown");
    }
    @Test void measuredHrDropCanKeepARecoveryWithASmallerPaceChange() {
        var input=stream(new int[]{1200,140,80,160},new double[]{2.6,3.1,2.84,3.3});
        input.forEach(row -> { int t=(int)row[2]; row[5]=t<1200?150:t>=1340 && t<=1420?158:170; });
        assertThat(segments(read(input))).extracting(SessionAnalysisService.Segment::kind)
            .containsExactly("warmup","work","recovery","work");
    }
    @Test void oneFastWindowCannotPromoteAnOtherwiseMarginalEffortWithoutHrSupport() {
        var input=stream(new int[]{1200,140,20,300},new double[]{2.5,2.8,3.1,2.5});
        input.forEach(row -> row[5]=150);
        assertThat(segments(read(input))).noneMatch(row->row.kind().equals("work"));
        input.forEach(row -> row[5]=null);
        assertThat(segments(read(input))).noneMatch(row->row.kind().equals("work"));
    }
    @Test void unseededPaceUndulationsCannotDragWorkBackThroughTheEasyPrelude() {
        var input=stream(new int[]{1200,60,20,60,20,60,20,60,20,180},
            new double[]{2.5,2.8,2.7,2.8,2.7,2.8,2.7,2.8,2.7,3.5});
        input.forEach(row -> row[5]=(int)row[2]<1520?150:170);
        var work=segments(read(input)).stream().filter(row->row.kind().equals("work")).toList();
        assertThat(work).hasSize(1);
        assertThat(work.get(0).startSeconds()).isGreaterThanOrEqualTo(1400);
    }
    @Test void sparseHrCannotTurnAShallowDipIntoRecovery() {
        var input=stream(new int[]{1200,140,80,160},new double[]{2.6,3.1,2.84,3.3});
        input.forEach(row -> {
            int t=(int)row[2];
            if(t>=1340 && t<=1405) row[5]=null;
            else row[5]=t<1200 || (t>1405 && t<=1420)?150:170;
        });
        var rows=segments(read(input));
        assertThat(rows).extracting(SessionAnalysisService.Segment::kind).containsExactly("warmup","work");
        assertThat(rows.get(1).measurements().hrCoverageFraction()).isLessThan(1);
    }
}
