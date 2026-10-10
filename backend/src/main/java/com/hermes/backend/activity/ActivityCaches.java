package com.hermes.backend.activity;

import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.HeatmapCacheKey;
import com.hermes.backend.runner.PersonalRecordService;

/**
 * Cached per-runner views that are built from the runner's runs. Anything that adds or removes runs
 * in bulk calls {@link #evictForRunner} so those views are rebuilt on the next read.
 */
public final class ActivityCaches {

    public static final String ACTIVITY_HEATMAP_NAMESPACE = "activity-heatmap";

    private ActivityCaches() {
    }

    /**
     * Drops the runner's profile heatmap, the all-time activity heatmap and the personal records.
     * Year-keyed activity-heatmap entries are left to expire on their own, as they always have been.
     */
    public static void evictForRunner(TtlCacheStore cacheStore, Long runnerId) {
        if (cacheStore == null || runnerId == null) {
            return;
        }
        cacheStore.evict(HeatmapCacheKey.NAMESPACE, HeatmapCacheKey.forRunner(runnerId));
        cacheStore.evict(ACTIVITY_HEATMAP_NAMESPACE, runnerId + ":all");
        cacheStore.evict(PersonalRecordService.CACHE_NAMESPACE, String.valueOf(runnerId));
    }
}
