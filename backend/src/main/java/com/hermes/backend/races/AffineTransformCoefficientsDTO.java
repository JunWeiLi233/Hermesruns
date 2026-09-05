package com.hermes.backend.races;

public record AffineTransformCoefficientsDTO(
        double latitudeXCoefficient,
        double latitudeYCoefficient,
        double latitudeIntercept,
        double longitudeXCoefficient,
        double longitudeYCoefficient,
        double longitudeIntercept
) {}
