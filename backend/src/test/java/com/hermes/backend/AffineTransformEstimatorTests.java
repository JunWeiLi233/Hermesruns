package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class AffineTransformEstimatorTests {

    @Test
    void estimateTransformFitsFourAnchorPairsToAffineCoefficients() {
        AffineTransformEstimator estimator = new AffineTransformEstimator();
        List<TestPixelAnchor> pixelAnchors = List.of(
                new TestPixelAnchor(10, 20),
                new TestPixelAnchor(50, 20),
                new TestPixelAnchor(10, 70),
                new TestPixelAnchor(60, 90)
        );
        List<TestGeoAnchor> geoAnchors = pixelAnchors.stream()
                .map(anchor -> new TestGeoAnchor(
                        40.0 + (0.01 * anchor.x()) + (0.02 * anchor.y()),
                        -73.0 + (-0.03 * anchor.x()) + (0.04 * anchor.y())
                ))
                .toList();

        AffineTransformCoefficientsDTO result = estimator.estimateTransform(pixelAnchors, geoAnchors);

        assertThat(result.latitudeXCoefficient()).isCloseTo(0.01, within(1.0e-9));
        assertThat(result.latitudeYCoefficient()).isCloseTo(0.02, within(1.0e-9));
        assertThat(result.latitudeIntercept()).isCloseTo(40.0, within(1.0e-9));
        assertThat(result.longitudeXCoefficient()).isCloseTo(-0.03, within(1.0e-9));
        assertThat(result.longitudeYCoefficient()).isCloseTo(0.04, within(1.0e-9));
        assertThat(result.longitudeIntercept()).isCloseTo(-73.0, within(1.0e-9));
    }

    @Test
    void estimateTransformFitsSixAnchorPairsToAffineCoefficients() {
        AffineTransformEstimator estimator = new AffineTransformEstimator();
        List<TestPixelAnchor> pixelAnchors = List.of(
                new TestPixelAnchor(10, 20),
                new TestPixelAnchor(50, 20),
                new TestPixelAnchor(10, 70),
                new TestPixelAnchor(60, 90),
                new TestPixelAnchor(80, 45),
                new TestPixelAnchor(35, 105)
        );
        List<TestGeoAnchor> geoAnchors = pixelAnchors.stream()
                .map(anchor -> new TestGeoAnchor(
                        40.0 + (0.01 * anchor.x()) + (0.02 * anchor.y()),
                        -73.0 + (-0.03 * anchor.x()) + (0.04 * anchor.y())
                ))
                .toList();

        AffineTransformCoefficientsDTO result = estimator.estimateTransform(pixelAnchors, geoAnchors);

        assertThat(result.latitudeXCoefficient()).isCloseTo(0.01, within(1.0e-9));
        assertThat(result.latitudeYCoefficient()).isCloseTo(0.02, within(1.0e-9));
        assertThat(result.latitudeIntercept()).isCloseTo(40.0, within(1.0e-9));
        assertThat(result.longitudeXCoefficient()).isCloseTo(-0.03, within(1.0e-9));
        assertThat(result.longitudeYCoefficient()).isCloseTo(0.04, within(1.0e-9));
        assertThat(result.longitudeIntercept()).isCloseTo(-73.0, within(1.0e-9));
    }

    @Test
    void estimateTransformRequiresAtLeastFourAnchorPairs() {
        AffineTransformEstimator estimator = new AffineTransformEstimator();

        assertThatThrownBy(() -> estimator.estimateTransform(
                List.of(
                        new TestPixelAnchor(10, 20),
                        new TestPixelAnchor(50, 20),
                        new TestPixelAnchor(10, 70)
                ),
                List.of(
                        new TestGeoAnchor(40.5, -72.5),
                        new TestGeoAnchor(40.9, -73.7),
                        new TestGeoAnchor(41.5, -70.5)
                )
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 4");
    }

    @Test
    void projectConvertsOrderedRoutePixelsIntoOrderedRawBreadcrumbs() {
        AffineTransformEstimator estimator = new AffineTransformEstimator();

        List<RawBreadcrumbPointDTO> result = estimator.project(
                List.of(
                        new RoutePixelPointDTO(0, 0),
                        new RoutePixelPointDTO(25, 40),
                        new RoutePixelPointDTO(50, 60)
                ),
                new AffineTransformCoefficientsDTO(
                        0.01,
                        0.02,
                        40.0,
                        -0.03,
                        0.04,
                        -73.0
                )
        );

        assertThat(result)
                .extracting(RawBreadcrumbPointDTO::latitude, RawBreadcrumbPointDTO::longitude)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(40.0, -73.0),
                        org.assertj.core.groups.Tuple.tuple(41.05, -72.15),
                        org.assertj.core.groups.Tuple.tuple(41.7, -72.1)
                );
    }

    private record TestPixelAnchor(
            int x,
            int y
    ) {}

    private record TestGeoAnchor(
            double latitude,
            double longitude
    ) {}
}
