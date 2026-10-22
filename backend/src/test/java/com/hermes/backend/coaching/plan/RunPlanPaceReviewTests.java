package com.hermes.backend.coaching.plan;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RunPlanPaceReviewTests {
    private RunPlanPaceReview.Sample sample(double actual){return new RunPlanPaceReview.Sample("workout","actual","metrics",actual,300);}
    @Test void fourRunMedianAveragesTheTwoCentralObservations() {
        assertEquals("ON_TRACK",RunPlanPaceReview.assess(List.of(sample(312),sample(312),sample(318),sample(318))).state());
        var faster=RunPlanPaceReview.assess(List.of(sample(279),sample(282),sample(285),sample(285)));
        assertEquals("RECOMMENDED",faster.state());assertEquals("FASTER",faster.direction());
    }
    @Test void exactDecimalSpreadBoundaryDoesNotBecomeVariableThroughBinaryRounding() {
        var boundary=RunPlanPaceReview.assess(List.of(sample(312),sample(318),sample(321)));
        assertEquals("RECOMMENDED",boundary.state());assertEquals("SLOWER",boundary.direction());
        assertEquals("VARIABLE",RunPlanPaceReview.assess(List.of(sample(312),sample(318),sample(321.0003))).state());
    }
    @Test void invalidPacesCannotBecomeValidRatiosByDividingTwoNegativeValues() {
        var invalid=new RunPlanPaceReview.Sample("w","a","hash",-300,-300);
        assertEquals("VARIABLE",RunPlanPaceReview.assess(List.of(invalid,invalid,invalid)).state());
    }
    @Test void insufficientMixedAndUnchangedEvidenceNeverRecommend() {
        assertEquals("NEED_MORE",RunPlanPaceReview.assess(List.of(sample(270),sample(270))).state());
        assertEquals("VARIABLE",RunPlanPaceReview.assess(List.of(sample(270),sample(290),sample(310))).state());
        assertEquals("ON_TRACK",RunPlanPaceReview.assess(List.of(sample(300),sample(301),sample(299))).state());
    }
    @Test void consistentTrendsOfferOnlyTheIndependentTwoPercentStep() {
        var faster=RunPlanPaceReview.assess(List.of(sample(270),sample(271),sample(269)));
        assertEquals("FASTER",faster.direction());assertEquals(98,faster.percent());
        var slower=RunPlanPaceReview.assess(List.of(sample(330),sample(331),sample(329)));
        assertEquals("SLOWER",slower.direction());assertEquals(102,slower.percent());
    }
    @Test void proposedPaceChangesDoNotChangeAnyTargetsDatesOrProtectedSteps() {
        var i=RunPlanEngineTests.inputs("DISTANCE",5000,8);
        i=new RunPlanEngine.Inputs(i.schemaVersion(),i.goalKind(),i.goalDistanceM(),i.startDate(),i.endDate(),i.timeZone(),true,i.experience(),i.trainingMode(),i.baselineWeeklyM(),i.baselineRunsPerWeek(),i.longestRecentM(),true,i.availableWeekdays(),i.runsPerWeek(),i.longRunWeekday(),i.volume(),i.difficulty(),new RunPlanEngine.Result(5000,1800,RunPlanEngineTests.TODAY),i.title(),null,"KM");
        var original=new RunPlanEngine().generate(i,RunPlanEngineTests.TODAY,List.of()).days();
        var next=RunPlanPaceReview.preview(original,RunPlanEngineTests.TODAY.plusWeeks(1),98);
        assertEquals(original.subList(0,7),next.days().subList(0,7));
        for(int n=0;n<original.size();n++) {
            var old=original.get(n);var d=next.days().get(n);
            assertEquals(old.localDate(),d.localDate());assertEquals(old.targetDistanceM(),d.targetDistanceM());assertEquals(old.targetDurationS(),d.targetDurationS());
            assertEquals(old.steps().size(),d.steps().size());
            for(int k=0;k<d.steps().size();k++){assertEquals(old.steps().get(k).distanceM(),d.steps().get(k).distanceM());assertEquals(old.steps().get(k).durationS(),d.steps().get(k).durationS());}
        }
    }
}
