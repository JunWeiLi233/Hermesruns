package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class AffineTransformEstimator {

    private static final double ENDPOINT_WEIGHT_BOOST = 2.0;
    private static final double MIN_WEIGHT = 1.0;
    private static final int QUADRATIC_PARAM_COUNT = 6;

    public AffineTransformCoefficientsDTO estimateTransform(List<?> pixelAnchors, List<?> geoAnchors) {
        return estimateTransformWeighted(pixelAnchors, geoAnchors, computeEndpointWeights(pixelAnchors.size()));
    }

    /**
     * Estimate an affine transform with per-anchor weights.
     * Anchors closer to the route endpoints (start/finish) receive higher weight
     * because they are more critical for overall route accuracy.
     */
    public AffineTransformCoefficientsDTO estimateTransformWeighted(
            List<?> pixelAnchors,
            List<?> geoAnchors,
            double[] weights
    ) {
        Objects.requireNonNull(pixelAnchors, "pixelAnchors must not be null");
        Objects.requireNonNull(geoAnchors, "geoAnchors must not be null");
        if (pixelAnchors.size() != geoAnchors.size()) {
            throw new IllegalArgumentException("Affine transform estimation requires matching pixel and geographic anchor counts");
        }
        if (pixelAnchors.size() < 4) {
            throw new IllegalArgumentException("Affine transform estimation requires at least 4 anchor pairs");
        }
        if (weights != null && weights.length != pixelAnchors.size()) {
            throw new IllegalArgumentException("Weights array length must match anchor count");
        }

        double[][] normalMatrix = new double[3][3];
        double[] latitudeTargets = new double[3];
        double[] longitudeTargets = new double[3];

        for (int index = 0; index < pixelAnchors.size(); index++) {
            Object pixelAnchor = Objects.requireNonNull(pixelAnchors.get(index), "pixel anchor must not be null");
            Object geoAnchor = Objects.requireNonNull(geoAnchors.get(index), "geo anchor must not be null");

            double x = readNumericAccessor(pixelAnchor, "x");
            double y = readNumericAccessor(pixelAnchor, "y");
            double latitude = readNumericAccessor(geoAnchor, "latitude");
            double longitude = readNumericAccessor(geoAnchor, "longitude");
            double w = weights == null ? 1.0 : weights[index];

            accumulateWeightedNormalMatrix(normalMatrix, x, y, w);
            accumulateWeightedTargetVector(latitudeTargets, x, y, latitude, w);
            accumulateWeightedTargetVector(longitudeTargets, x, y, longitude, w);
        }

        double[] latitudeCoefficients = solve3x3(normalMatrix, latitudeTargets);
        double[] longitudeCoefficients = solve3x3(normalMatrix, longitudeTargets);

        return new AffineTransformCoefficientsDTO(
                latitudeCoefficients[0],
                latitudeCoefficients[1],
                latitudeCoefficients[2],
                longitudeCoefficients[0],
                longitudeCoefficients[1],
                longitudeCoefficients[2]
        );
    }

    /**
     * Fit a quadratic (second-order polynomial) transform when the affine
     * model is insufficient for maps with perspective distortion or
     * non-linear projection. Uses 6 parameters per coordinate dimension.
     * Requires at least 6 anchor pairs.
     */
    public QuadraticTransformDTO estimateQuadraticTransform(List<?> pixelAnchors, List<?> geoAnchors) {
        Objects.requireNonNull(pixelAnchors, "pixelAnchors must not be null");
        Objects.requireNonNull(geoAnchors, "geoAnchors must not be null");
        if (pixelAnchors.size() != geoAnchors.size()) {
            throw new IllegalArgumentException("Quadratic transform estimation requires matching pixel and geographic anchor counts");
        }
        if (pixelAnchors.size() < QUADRATIC_PARAM_COUNT) {
            throw new IllegalArgumentException("Quadratic transform estimation requires at least " + QUADRATIC_PARAM_COUNT + " anchor pairs");
        }

        double[] weights = computeEndpointWeights(pixelAnchors.size());
        double[][] normalMatrix = new double[QUADRATIC_PARAM_COUNT][QUADRATIC_PARAM_COUNT];
        double[] latitudeTargets = new double[QUADRATIC_PARAM_COUNT];
        double[] longitudeTargets = new double[QUADRATIC_PARAM_COUNT];

        for (int index = 0; index < pixelAnchors.size(); index++) {
            Object pixelAnchor = Objects.requireNonNull(pixelAnchors.get(index), "pixel anchor must not be null");
            Object geoAnchor = Objects.requireNonNull(geoAnchors.get(index), "geo anchor must not be null");

            double x = readNumericAccessor(pixelAnchor, "x");
            double y = readNumericAccessor(pixelAnchor, "y");
            double latitude = readNumericAccessor(geoAnchor, "latitude");
            double longitude = readNumericAccessor(geoAnchor, "longitude");
            double w = weights[index];

            // Quadratic basis: [x, y, x^2, x*y, y^2, 1]
            double[] basis = {x, y, x * x, x * y, y * y, 1.0};
            for (int row = 0; row < QUADRATIC_PARAM_COUNT; row++) {
                for (int col = 0; col < QUADRATIC_PARAM_COUNT; col++) {
                    normalMatrix[row][col] += w * basis[row] * basis[col];
                }
                latitudeTargets[row] += w * basis[row] * latitude;
                longitudeTargets[row] += w * basis[row] * longitude;
            }
        }

        double[] latitudeCoefficients = solveNxN(normalMatrix, latitudeTargets);
        double[] longitudeCoefficients = solveNxN(normalMatrix, longitudeTargets);

        return new QuadraticTransformDTO(latitudeCoefficients, longitudeCoefficients);
    }

    public List<RawBreadcrumbPointDTO> projectQuadratic(
            List<RoutePixelPointDTO> routePixels,
            QuadraticTransformDTO coefficients
    ) {
        Objects.requireNonNull(routePixels, "routePixels must not be null");
        Objects.requireNonNull(coefficients, "coefficients must not be null");

        double[] lat = coefficients.latitudeCoefficients();
        double[] lon = coefficients.longitudeCoefficients();

        List<RawBreadcrumbPointDTO> result = new ArrayList<>(routePixels.size());
        for (RoutePixelPointDTO routePixel : routePixels) {
            double x = routePixel.x();
            double y = routePixel.y();
            // Quadratic basis: [x, y, x^2, x*y, y^2, 1]
            double latitude = lat[0] * x + lat[1] * y + lat[2] * x * x + lat[3] * x * y + lat[4] * y * y + lat[5];
            double longitude = lon[0] * x + lon[1] * y + lon[2] * x * x + lon[3] * x * y + lon[4] * y * y + lon[5];
            result.add(new RawBreadcrumbPointDTO(latitude, longitude));
        }
        return List.copyOf(result);
    }

    /**
     * Compute per-anchor weights that boost anchors near the route endpoints.
     * Uses a symmetric triangular weighting: weight is highest at start (index 0)
     * and finish (index n-1), decreasing linearly to 1.0 at the midpoint.
     * This prioritizes start/finish accuracy while still using mid-route anchors.
     */
    public static double[] computeEndpointWeights(int anchorCount) {
        if (anchorCount <= 2) {
            double[] weights = new double[anchorCount];
            for (int i = 0; i < anchorCount; i++) {
                weights[i] = 1.0 + ENDPOINT_WEIGHT_BOOST;
            }
            return weights;
        }

        double[] weights = new double[anchorCount];
        double lastIndex = anchorCount - 1.0;
        for (int i = 0; i < anchorCount; i++) {
            // Distance from nearest endpoint, normalized to [0, 1]
            double normalizedDistance = Math.min(i, lastIndex - i) / (lastIndex / 2.0);
            // Weight = MIN_WEIGHT + ENDPOINT_WEIGHT_BOOST * (1 - normalizedDistance)
            weights[i] = MIN_WEIGHT + ENDPOINT_WEIGHT_BOOST * Math.max(0.0, 1.0 - normalizedDistance);
        }
        return weights;
    }

    public List<RawBreadcrumbPointDTO> project(
            List<RoutePixelPointDTO> routePixels,
            AffineTransformCoefficientsDTO coefficients
    ) {
        Objects.requireNonNull(routePixels, "routePixels must not be null");
        Objects.requireNonNull(coefficients, "coefficients must not be null");

        List<RawBreadcrumbPointDTO> result = new ArrayList<>(routePixels.size());
        for (RoutePixelPointDTO routePixel : routePixels) {
            double latitude = coefficients.latitudeIntercept()
                    + (coefficients.latitudeXCoefficient() * routePixel.x())
                    + (coefficients.latitudeYCoefficient() * routePixel.y());
            double longitude = coefficients.longitudeIntercept()
                    + (coefficients.longitudeXCoefficient() * routePixel.x())
                    + (coefficients.longitudeYCoefficient() * routePixel.y());
            result.add(new RawBreadcrumbPointDTO(latitude, longitude));
        }
        return List.copyOf(result);
    }

    private static void accumulateNormalMatrix(double[][] normalMatrix, double x, double y) {
        accumulateWeightedNormalMatrix(normalMatrix, x, y, 1.0);
    }

    private static void accumulateWeightedNormalMatrix(double[][] normalMatrix, double x, double y, double w) {
        double[] row = {x, y, 1.0};
        for (int matrixRow = 0; matrixRow < 3; matrixRow++) {
            for (int matrixColumn = 0; matrixColumn < 3; matrixColumn++) {
                normalMatrix[matrixRow][matrixColumn] += w * row[matrixRow] * row[matrixColumn];
            }
        }
    }

    private static void accumulateTargetVector(double[] targetVector, double x, double y, double value) {
        accumulateWeightedTargetVector(targetVector, x, y, value, 1.0);
    }

    private static void accumulateWeightedTargetVector(double[] targetVector, double x, double y, double value, double w) {
        double[] row = {x, y, 1.0};
        for (int matrixRow = 0; matrixRow < 3; matrixRow++) {
            targetVector[matrixRow] += w * row[matrixRow] * value;
        }
    }

    private static double[] solve3x3(double[][] coefficients, double[] targets) {
        double[][] augmented = new double[3][4];
        for (int row = 0; row < 3; row++) {
            System.arraycopy(coefficients[row], 0, augmented[row], 0, 3);
            augmented[row][3] = targets[row];
        }

        for (int pivotIndex = 0; pivotIndex < 3; pivotIndex++) {
            int bestRow = pivotIndex;
            for (int candidate = pivotIndex + 1; candidate < 3; candidate++) {
                if (Math.abs(augmented[candidate][pivotIndex]) > Math.abs(augmented[bestRow][pivotIndex])) {
                    bestRow = candidate;
                }
            }
            if (Math.abs(augmented[bestRow][pivotIndex]) < 1.0e-12) {
                throw new IllegalArgumentException("Anchor pairs do not span a solvable affine transform");
            }
            swapRows(augmented, pivotIndex, bestRow);

            double pivotValue = augmented[pivotIndex][pivotIndex];
            for (int column = pivotIndex; column < 4; column++) {
                augmented[pivotIndex][column] /= pivotValue;
            }

            for (int row = 0; row < 3; row++) {
                if (row == pivotIndex) {
                    continue;
                }
                double factor = augmented[row][pivotIndex];
                if (factor == 0.0) {
                    continue;
                }
                for (int column = pivotIndex; column < 4; column++) {
                    augmented[row][column] -= factor * augmented[pivotIndex][column];
                }
            }
        }

        return new double[] {augmented[0][3], augmented[1][3], augmented[2][3]};
    }

    private static void swapRows(double[][] matrix, int first, int second) {
        if (first == second) {
            return;
        }
        double[] temp = matrix[first];
        matrix[first] = matrix[second];
        matrix[second] = temp;
    }

    private static double[] solveNxN(double[][] coefficients, double[] targets) {
        int size = coefficients.length;
        double[][] augmented = new double[size][size + 1];
        for (int row = 0; row < size; row++) {
            System.arraycopy(coefficients[row], 0, augmented[row], 0, size);
            augmented[row][size] = targets[row];
        }

        for (int pivotIndex = 0; pivotIndex < size; pivotIndex++) {
            int bestRow = pivotIndex;
            for (int candidate = pivotIndex + 1; candidate < size; candidate++) {
                if (Math.abs(augmented[candidate][pivotIndex]) > Math.abs(augmented[bestRow][pivotIndex])) {
                    bestRow = candidate;
                }
            }
            if (Math.abs(augmented[bestRow][pivotIndex]) < 1.0e-12) {
                throw new IllegalArgumentException(
                        "Anchor pairs do not span a solvable system of size " + size);
            }
            swapRows(augmented, pivotIndex, bestRow);

            double pivotValue = augmented[pivotIndex][pivotIndex];
            for (int column = pivotIndex; column < size + 1; column++) {
                augmented[pivotIndex][column] /= pivotValue;
            }

            for (int row = 0; row < size; row++) {
                if (row == pivotIndex) {
                    continue;
                }
                double factor = augmented[row][pivotIndex];
                if (factor == 0.0) {
                    continue;
                }
                for (int column = pivotIndex; column < size + 1; column++) {
                    augmented[row][column] -= factor * augmented[pivotIndex][column];
                }
            }
        }

        double[] solution = new double[size];
        for (int i = 0; i < size; i++) {
            solution[i] = augmented[i][size];
        }
        return solution;
    }

    private static double readNumericAccessor(Object source, String accessorName) {
        try {
            Object value = source.getClass().getMethod(accessorName).invoke(source);
            if (value instanceof Number number) {
                return number.doubleValue();
            }
            throw new IllegalArgumentException("Accessor '" + accessorName + "' must return a numeric value");
        } catch (NoSuchMethodException exception) {
            throw new IllegalArgumentException(
                    "Expected accessor '" + accessorName + "()' on " + source.getClass().getSimpleName(),
                    exception
            );
        } catch (IllegalAccessException | InvocationTargetException exception) {
            throw new IllegalStateException(
                    "Failed to read accessor '" + accessorName + "()' on " + source.getClass().getSimpleName(),
                    exception
            );
        }
    }

    public record QuadraticTransformDTO(
            double[] latitudeCoefficients,
            double[] longitudeCoefficients
    ) {
        public QuadraticTransformDTO {
            Objects.requireNonNull(latitudeCoefficients, "latitudeCoefficients must not be null");
            Objects.requireNonNull(longitudeCoefficients, "longitudeCoefficients must not be null");
            if (latitudeCoefficients.length != QUADRATIC_PARAM_COUNT) {
                throw new IllegalArgumentException(
                        "latitudeCoefficients must have " + QUADRATIC_PARAM_COUNT + " elements");
            }
            if (longitudeCoefficients.length != QUADRATIC_PARAM_COUNT) {
                throw new IllegalArgumentException(
                        "longitudeCoefficients must have " + QUADRATIC_PARAM_COUNT + " elements");
            }
        }
    }
}
