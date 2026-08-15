package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RouteHeatmapAnchorServiceTests {

    @Test
    void selectAnchorPrefersTheCellVisitedByMoreDistinctRuns() {
        RouteHeatmapAnchorService.RouteAnchor anchor = RouteHeatmapAnchorService.selectAnchor(List.of(
                point(1L, 40.71241, -74.00641),
                point(1L, 40.71242, -74.00642),
                point(2L, 40.71243, -74.00643),
                point(3L, 40.71244, -74.00644),
                point(9L, 40.73041, -73.99041),
                point(9L, 40.73042, -73.99042),
                point(9L, 40.73043, -73.99043),
                point(9L, 40.73044, -73.99044),
                point(9L, 40.73045, -73.99045)
        ));

        assertThat(anchor).isNotNull();
        assertThat(anchor.activityCount()).isEqualTo(3);
        assertThat(anchor.pointCount()).isEqualTo(4);
        assertThat(anchor.startLat()).isBetween(40.7124, 40.7125);
        assertThat(anchor.startLng()).isBetween(-74.0065, -74.0064);
    }

    @Test
    void selectAnchorIgnoresInvalidCoordinates() {
        RouteHeatmapAnchorService.RouteAnchor anchor = RouteHeatmapAnchorService.selectAnchor(List.of(
                point(1L, 91.0, -74.0),
                point(2L, 40.7, -181.0),
                point(3L, Double.NaN, -74.0)
        ));

        assertThat(anchor).isNull();
    }

    private static Object[] point(long activityId, double latitude, double longitude) {
        return new Object[]{activityId, latitude, longitude, null, null};
    }
}
