package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Aggregates ShoeIdentityService + ShoeImageAssetService for admin use,
 * reducing dependency count in consumers.
 */
@Service
public class ShoeAdminAggregateService {

    private final ShoeIdentityService shoeIdentityService;
    private final ShoeImageAssetService shoeImageAssetService;

    public ShoeAdminAggregateService(ShoeIdentityService shoeIdentityService, ShoeImageAssetService shoeImageAssetService) {
        this.shoeIdentityService = shoeIdentityService;
        this.shoeImageAssetService = shoeImageAssetService;
    }

    public void applyIdentityKey(Shoe shoe) {
        shoeIdentityService.applyIdentityKey(shoe);
    }

    public String computeIdentityKey(String brand, String model) {
        return shoeIdentityService.computeIdentityKey(brand, model);
    }

    public ShoeImageAsset upsertPendingForShoe(Shoe shoe, String imageUrl, String source, String actorEmail) {
        return shoeImageAssetService.upsertPendingForShoe(shoe, imageUrl, source, actorEmail);
    }

    public ShoeImageAsset acceptPendingForShoe(Shoe shoe, String actorEmail) {
        return shoeImageAssetService.acceptPendingForShoe(shoe, actorEmail);
    }

    public ShoeImageAsset clearPendingForShoe(Shoe shoe) {
        return shoeImageAssetService.clearPendingForShoe(shoe);
    }

    public Map<String, ShoeImageAsset> loadAssetsForShoes(List<Shoe> shoes) {
        return shoeImageAssetService.loadAssetsForShoes(shoes);
    }

    public ShoeAdminDto toShoeDto(Shoe shoe) {
        return toShoeDto(shoe, null);
    }

    public ShoeAdminDto toShoeDto(Shoe shoe, ShoeImageAsset asset) {
        return new ShoeAdminDto(
                shoe.getId(),
                shoe.getBrand(),
                shoe.getModel(),
                shoe.getNickname(),
                shoe.getIdentityKey(),
                shoe.getPhotoUrl(),
                shoe.isPhotoVerified(),
                asset == null ? null : asset.getPendingImageUrl(),
                asset == null ? null : asset.getPendingSource(),
                asset == null ? null : asset.getLiveImageUrl(),
                asset == null ? null : asset.getLiveSource(),
                shoe.isRetired(),
                shoe.getCreatedAt() == null ? null : shoe.getCreatedAt().toString(),
                shoe.getRunner() == null ? null : shoe.getRunner().getId(),
                shoe.getRunner() == null ? null : shoe.getRunner().getEmail()
        );
    }
}
