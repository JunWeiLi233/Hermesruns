package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class AffineTransformEstimator {

    public AffineTransformCoefficientsDTO estimateTransform(List<?> pixelAnchors, List<?> geoAnchors) {
        Objects.requireNonNull(pixelAnchors, "pixelAnchors must not be null");
        Objects.requireNonNull(geoAnchors, "geoAnchors must not be null");
        if (pixelAnchors.size() != 4 || geoAnchors.size() != 4) {
            throw new IllegalArgumentException("Affine transform estimation requires exactly 4 anchor pairs");
        }

        double[][] normalMatrix = new double[3][3];
        double[] latitudeTargets = new double[3];
        double[] longitudeTargets = new double[3];

        for (int index = 0; index < 4; index++) {
            Object pixelAnchor = Objects.requireNonNull(pixelAnchors.get(index), "pixel anchor must not be null");
            Object geoAnchor = Objects.requireNonNull(geoAnchors.get(index), "geo anchor must not be null");

            double x = readNumericAccessor(pixelAnchor, "x");
            double y = readNumericAccessor(pixelAnchor, "y");
            double latitude = readNumericAccessor(geoAnchor, "latitude");
            double longitude = readNumericAccessor(geoAnchor, "longitude");

            accumulateNormalMatrix(normalMatrix, x, y);
            accumulateTargetVector(latitudeTargets, x, y, latitude);
            accumulateTargetVector(longitudeTargets, x, y, longitude);
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
        double[] row = {x, y, 1.0};
        for (int matrixRow = 0; matrixRow < 3; matrixRow++) {
            for (int matrixColumn = 0; matrixColumn < 3; matrixColumn++) {
                normalMatrix[matrixRow][matrixColumn] += row[matrixRow] * row[matrixColumn];
            }
        }
    }

    private static void accumulateTargetVector(double[] targetVector, double x, double y, double value) {
        double[] row = {x, y, 1.0};
        for (int matrixRow = 0; matrixRow < 3; matrixRow++) {
            targetVector[matrixRow] += row[matrixRow] * value;
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
}
