package com.hermes.backend.heatmap;

import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class RecordedWorkoutTilesTests {
    static double[] point(double x,double y){return new double[]{Math.toDegrees(Math.atan(Math.sinh(Math.PI*(1-2*y/16384)))),x/16384*360-180};}
    @Test void traversesFullSegmentsWithoutSamplingAndDeduplicatesRepeats() {
        var a=point(8000.2,6000.2);var b=point(8003.8,6000.2);
        var cells=RecordedWorkoutTiles.cells(List.of(List.of(a,b,a)));
        assertThat(cells).containsExactlyInAnyOrder(RecordedWorkoutTiles.cell(8000,6000),RecordedWorkoutTiles.cell(8001,6000),RecordedWorkoutTiles.cell(8002,6000),RecordedWorkoutTiles.cell(8003,6000));
        assertThat(RecordedWorkoutTiles.cells(List.of(List.of(a,a),List.of(b,b)))).hasSize(2);
    }
    @Test void diagonalCornerIsHalfOpenAndDoesNotFillTheBoundingBox() {
        var cells=RecordedWorkoutTiles.cells(List.of(List.of(point(8000.25,6000.25),point(8002.75,6002.75))));
        assertThat(cells).hasSize(3).doesNotContain(RecordedWorkoutTiles.cell(8001,6000));
    }
    @Test void noveltyUsesAllHistoryStableTiesAndUnknownChronology() {
        var instant=Instant.parse("2026-10-19T12:00:00Z");long a=1,b=2,c=3;
        var history=RecordedWorkoutTiles.history(List.of(new RecordedWorkoutTiles.Visit(2,instant,Set.of(a,b)),new RecordedWorkoutTiles.Visit(1,instant,Set.of(a)),new RecordedWorkoutTiles.Visit(3,instant.plusSeconds(1),Set.of(b,c))));
        assertThat(history.get(1L).added()).containsExactly(a);assertThat(history.get(2L).added()).containsExactly(b);assertThat(history.get(3L).added()).containsExactly(c);
        var uncertain=RecordedWorkoutTiles.history(List.of(new RecordedWorkoutTiles.Visit(1,null,Set.of(c)),new RecordedWorkoutTiles.Visit(2,instant,Set.of(a,c))));
        assertThat(uncertain.get(1L).added()).isNull();assertThat(uncertain.get(2L).added()).isNull();assertThat(uncertain.get(2L).visited()).hasSize(2);
    }
    @Test void reverseAndCollinearSamplesPreserveTheSameNewCellIdentities() {
        for(var ends:List.of(new double[]{8000.2,6000.2,8010.8,6010.8},new double[]{8010.8,6000.2,8000.2,6010.8})) {
            var a=point(ends[0],ends[1]);var b=point(ends[2],ends[3]);
            var middle=point(ends[0]+(ends[2]-ends[0])/3,ends[1]+(ends[3]-ends[1])/3);
            var sparse=RecordedWorkoutTiles.cells(List.of(List.of(a,b)));
            assertThat(RecordedWorkoutTiles.cells(List.of(List.of(b,a)))).isEqualTo(sparse);
            assertThat(RecordedWorkoutTiles.cells(List.of(List.of(a,middle,b)))).isEqualTo(sparse);
        }
    }
}
