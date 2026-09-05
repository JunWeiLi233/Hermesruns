package com.hermes.backend.runner;

public final class HeatmapCacheKey {
    public static final String NAMESPACE = "profile-heatmap";
    private static final String VERSION = "all-points-paged-v4";

    private HeatmapCacheKey() {
    }

    public static String forRunner(Long runnerId) {
        return VERSION + ":" + runnerId;
    }
}
