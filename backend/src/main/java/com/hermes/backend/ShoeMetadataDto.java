package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ShoeMetadataDto(
        String brand,
        String model,
        String colorway,
        String searchString
) {
    public ShoeMetadataDto {
        brand = normalize(brand);
        model = normalize(model);
        colorway = normalize(colorway);
        searchString = normalize(searchString);
        if (searchString == null) {
            searchString = buildSearchString(brand, model, colorway);
        }
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim().replaceAll("\\s+", " ");
        return trimmed.isBlank() ? null : trimmed;
    }

    private static String buildSearchString(String brand, String model, String colorway) {
        List<String> parts = new ArrayList<>();
        if (brand != null) parts.add(brand);
        if (model != null) parts.add(model);
        if (colorway != null) parts.add(colorway);
        if (parts.isEmpty()) return null;
        return String.join(" ", parts);
    }
}
