package com.hermes.backend;

public record SavedFilterDto(Long id, String scope, String name, String queryJson, String updatedAt) {
}
