package com.hermes.backend;

final class HeatmapCacheKey {
    static final String NAMESPACE = "profile-heatmap";
    private static final String VERSION = "all-points-paged-v4";

    private HeatmapCacheKey() {
    }

    static String forRunner(Long runnerId) {
        return VERSION + ":" + runnerId;
    }
}
