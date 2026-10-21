package com.hermes.backend.shoes;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShoeImageAssetRepository extends JpaRepository<ShoeImageAsset, Long> {
    Optional<ShoeImageAsset> findByIdentityKey(String identityKey);
    List<ShoeImageAsset> findByIdentityKeyIn(List<String> identityKeys);

    @Query("SELECT a.identityKey AS identityKey, a.liveImageUrl AS liveImageUrl FROM ShoeImageAsset a "
            + "WHERE a.identityKey IN :keys AND a.liveImageUrl IS NOT NULL")
    List<LiveImage> findLiveImagesByIdentityKeys(@Param("keys") List<String> keys);

    interface LiveImage {
        String getIdentityKey();
        String getLiveImageUrl();
    }
}
