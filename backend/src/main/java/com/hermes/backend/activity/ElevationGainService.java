package com.hermes.backend.activity;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fills in the climb of a run that has none, from the elevation of its points: the runs imported from a GPX, TCX or FIT
 * file before the importer worked the climb out. The corrected profile is used when the run has one.
 */
@Service
class ElevationGainService {

    private final ElevationGainRepository elevations;
    private final ActivityRepository activities;

    ElevationGainService(ElevationGainRepository elevations, ActivityRepository activities) {
        this.elevations = elevations;
        this.activities = activities;
    }

    /** True when the run now has a climb figure. A figure the run already has, from its source, is never replaced. */
    @Transactional
    boolean fill(Long activityId) {
        Optional<Activity> found = activities.findById(activityId);
        if (found.isEmpty() || found.get().getTotalElevationGain() != null) {
            return false;
        }
        List<Double> corrected = new ArrayList<>();
        List<Double> raw = new ArrayList<>();
        boolean anyCorrected = false;
        for (Object[] columns : elevations.findElevationColumns(activityId)) {
            Double fixed = (Double) columns[0];
            Double measured = columns[1] != null ? (Double) columns[1] : (Double) columns[2];
            corrected.add(fixed);
            raw.add(measured);
            anyCorrected |= fixed != null;
        }
        Double climb = ElevationAscent.of(anyCorrected ? corrected : raw);
        if (climb == null) {
            return false;
        }
        Activity activity = found.get();
        activity.setTotalElevationGain(climb);
        activities.save(activity);
        return true;
    }
}
