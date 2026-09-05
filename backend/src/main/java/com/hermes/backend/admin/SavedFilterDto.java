package com.hermes.backend.admin;

public record SavedFilterDto(Long id, String scope, String name, String queryJson, String updatedAt) {
}
