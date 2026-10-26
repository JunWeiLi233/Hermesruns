package com.hermes.backend.activity;

/** Always exercises H2, including full suites that also configure the PostgreSQL query fixtures. */
class ActivityPointRoutePreviewH2QueryTests extends ActivityPointRoutePreviewQueryTests {
    @Override
    protected String postgresUrl() {
        return null;
    }
}
