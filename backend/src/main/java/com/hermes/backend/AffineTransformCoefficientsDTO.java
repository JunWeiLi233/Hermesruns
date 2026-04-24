package com.hermes.backend;

public record AffineTransformCoefficientsDTO(
        double latitudeXCoefficient,
        double latitudeYCoefficient,
        double latitudeIntercept,
        double longitudeXCoefficient,
        double longitudeYCoefficient,
        double longitudeIntercept
) {}
