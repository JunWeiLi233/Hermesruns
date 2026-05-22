package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ShoeImageAssetService {
    private final ShoeImageAssetRepository shoeImageAssetRepository;
    private final ShoeRepository shoeRepository;

    public ShoeImageAssetService(ShoeImageAssetRepository shoeImageAssetRepository, ShoeRepository shoeRepository) {
        this.shoeImageAssetRepository = shoeImageAssetRepository;
        this.shoeRepository = shoeRepository;
    }

    public ShoeImageAsset upsertPendingForShoe(Shoe shoe, String imageUrl, String source, String actorEmail) {
        String identityKey = requireIdentityKey(shoe);
        ShoeImageAsset asset = shoeImageAssetRepository.findByIdentityKey(identityKey).orElseGet(ShoeImageAsset::new);
        asset.setIdentityKey(identityKey);
        if (asset.getRunner() == null) {
            asset.setRunner(shoe.getRunner());
        }
        asset.setBrand(shoe.getBrand());
        asset.setModel(shoe.getModel());
        asset.setPendingImageUrl(imageUrl);
        asset.setPendingSource(source);
        asset.setPendingUpdatedAt(LocalDateTime.now());
        asset.setPendingUpdatedByEmail(actorEmail);
        return shoeImageAssetRepository.save(asset);
    }

    public ShoeImageAsset acceptPendingForShoe(Shoe shoe, String actorEmail) {
        String identityKey = requireIdentityKey(shoe);
        ShoeImageAsset asset = shoeImageAssetRepository.findByIdentityKey(identityKey)
                .orElseThrow(() -> new IllegalArgumentException("Shoe image asset not found."));
        if (asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("No pending shoe image preview to publish.");
        }
        asset.setLiveImageUrl(asset.getPendingImageUrl());
        asset.setLiveSource(asset.getPendingSource());
        if (asset.getRunner() == null) {
            asset.setRunner(shoe.getRunner());
        }
        asset.setLiveUpdatedAt(LocalDateTime.now());
        asset.setLiveUpdatedByEmail(actorEmail);
        shoeImageAssetRepository.save(asset);

        List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(shoe.getBrand(), shoe.getModel());
        for (Shoe item : matching) {
            item.setPhotoUrl(asset.getLiveImageUrl());
            item.setPhotoVerified(true);
        }
        shoeRepository.saveAll(matching);
        return asset;
    }

    public ShoeImageAsset clearPendingForShoe(Shoe shoe) {
        String identityKey = requireIdentityKey(shoe);
        ShoeImageAsset asset = shoeImageAssetRepository.findByIdentityKey(identityKey)
                .orElseThrow(() -> new IllegalArgumentException("Shoe image asset not found."));
        asset.setPendingImageUrl(null);
        asset.setPendingSource(null);
        asset.setPendingUpdatedAt(null);
        asset.setPendingUpdatedByEmail(null);
        return shoeImageAssetRepository.save(asset);
    }

    public Map<String, ShoeImageAsset> loadAssetsForShoes(List<Shoe> shoes) {
        List<String> identityKeys = shoes.stream()
                .map(Shoe::getIdentityKey)
                .filter(key -> key != null && !key.isBlank())
                .distinct()
                .toList();
        if (identityKeys.isEmpty()) return Map.of();
        return shoeImageAssetRepository.findByIdentityKeyIn(identityKeys).stream()
                .collect(Collectors.toMap(ShoeImageAsset::getIdentityKey, Function.identity()));
    }

    private String requireIdentityKey(Shoe shoe) {
        String identityKey = shoe.getIdentityKey();
        if (identityKey == null || identityKey.isBlank()) {
            throw new IllegalArgumentException("Shoe identity key is required.");
        }
        return identityKey;
    }
}
