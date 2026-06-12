package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

class ActivityPointTests {

    @Test
    void fieldsRoundTrip() {
        var p = new ActivityPoint();
        p.setId(1L);
        p.setSequenceIndex(5);
        p.setLatitude(47.6);
        p.setLongitude(-122.3);
        p.setElapsedSeconds(120);
        p.setDistanceMeters(400.0);
        p.setElevationMeters(50.0);
        p.setElevationRawMeters(51.0);
        p.setElevationCorrectedMeters(49.5);
        p.setHeartRate(145);
        p.setCadence(82);

        assertEquals(1L, p.getId());
        assertEquals(5, p.getSequenceIndex());
        assertEquals(47.6, p.getLatitude());
        assertEquals(-122.3, p.getLongitude());
        assertEquals(120, p.getElapsedSeconds());
        assertEquals(400.0, p.getDistanceMeters());
        assertEquals(50.0, p.getElevationMeters());
        assertEquals(51.0, p.getElevationRawMeters());
        assertEquals(49.5, p.getElevationCorrectedMeters());
        assertEquals(145, p.getHeartRate());
        assertEquals(82, p.getCadence());
    }

    @Test
    void nullableNumericFields() {
        var p = new ActivityPoint();
        assertNull(p.getElapsedSeconds());
        assertNull(p.getDistanceMeters());
        assertNull(p.getElevationMeters());
        assertNull(p.getElevationRawMeters());
        assertNull(p.getElevationCorrectedMeters());
        assertNull(p.getHeartRate());
        assertNull(p.getCadence());
    }

    @Test
    void activityRelationship() {
        var a = new Activity();
        var p = new ActivityPoint();
        p.setActivity(a);
        assertSame(a, p.getActivity());
    }

    @Test
    void sequenceIndexDefault() {
        var p = new ActivityPoint();
        assertEquals(0, p.getSequenceIndex());
    }

    @Test
    void geoCoordinates() {
        var p = new ActivityPoint();
        p.setLatitude(48.8566);
        p.setLongitude(2.3522);
        assertEquals(48.8566, p.getLatitude());
        assertEquals(2.3522, p.getLongitude());
    }

    @Test
    void elevationHierarchy() {
        var p = new ActivityPoint();
        p.setElevationMeters(100.0);
        p.setElevationRawMeters(102.0);
        p.setElevationCorrectedMeters(99.0);

        assertEquals(100.0, p.getElevationMeters());
        assertEquals(102.0, p.getElevationRawMeters());
        assertEquals(99.0, p.getElevationCorrectedMeters());
    }

    // --- Ownership structure tests ---

    @Test
    void noDirectRunnerIdField() throws Exception {
        // ActivityPoint must NOT have a direct runnerId field.
        // Ownership flows transitively: ActivityPoint -> Activity -> Runner.
        // A direct runnerId would create a bypass path around the Activity ownership check.
        var fields = ActivityPoint.class.getDeclaredFields();
        for (var field : fields) {
            assertFalse(
                    field.getName().equalsIgnoreCase("runnerId")
                            || field.getName().equalsIgnoreCase("runner"),
                    "ActivityPoint must not have a direct runner reference. "
                            + "Found field: " + field.getName()
            );
        }
    }

    @Test
    void getActivityIsJsonIgnored() throws Exception {
        // The getActivity() method must be annotated with @JsonIgnore
        // to prevent the full Activity graph from leaking into API responses.
        // Without this, cross-runner data could be exposed through serialization.
        Method getter = ActivityPoint.class.getMethod("getActivity");
        JsonIgnore annotation = getter.getAnnotation(JsonIgnore.class);
        assertNotNull(annotation,
                "getActivity() must be annotated with @JsonIgnore. "
                        + "Without it, the Activity graph (including runner data) "
                        + "could leak into serialized API responses.");
    }

    @Test
    void activityFieldIsRequired() throws Exception {
        // The activity relationship must be non-optional (nullable = false).
        // An orphaned ActivityPoint without an Activity is a data integrity risk.
        var field = ActivityPoint.class.getDeclaredField("activity");
        var joinColumn = field.getAnnotation(jakarta.persistence.JoinColumn.class);
        assertNotNull(joinColumn, "activity field must have @JoinColumn");
        assertFalse(joinColumn.nullable(),
                "activity relationship must be non-nullable. "
                        + "Orphaned points without a parent Activity are a data integrity risk.");
    }

    @Test
    void transitiveOwnershipChainIsIntact() {
        // Verify the ownership chain structurally:
        // ActivityPoint knows Activity, Activity knows Runner.
        // This is the foundation of the security model.
        Activity activity = new Activity();
        Runner runner = new Runner();
        runner.setId(42L);
        activity.setRunner(runner);

        ActivityPoint point = new ActivityPoint();
        point.setActivity(activity);

        assertNotNull(point.getActivity(), "ActivityPoint must reference an Activity");
        assertNotNull(point.getActivity().getRunner(), "Activity must reference a Runner");
        assertEquals(42L, point.getActivity().getRunner().getId(),
                "Transitive ownership chain: ActivityPoint -> Activity -> Runner must be intact");
    }
}
