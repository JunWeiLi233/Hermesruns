package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ShoeImageAssetService {
    private final ShoeImageAssetRepository shoeImageAssetRepository;
    private final ShoeRepository shoeRepository;
    private final ShoeIdentityService shoeIdentityService;

    public ShoeImageAssetService(ShoeImageAssetRepository shoeImageAssetRepository, ShoeRepository shoeRepository) {
        this(shoeImageAssetRepository, shoeRepository, new ShoeIdentityService());
    }

    @Autowired
    public ShoeImageAssetService(ShoeImageAssetRepository shoeImageAssetRepository,
                                 ShoeRepository shoeRepository,
                                 ShoeIdentityService shoeIdentityService) {
        this.shoeImageAssetRepository = shoeImageAssetRepository;
        this.shoeRepository = shoeRepository;
        this.shoeIdentityService = shoeIdentityService;
    }

    public ShoeImageAsset upsertPendingForShoe(Shoe shoe, String imageUrl, String source, String actorEmail) {
        return upsertPendingForIdentity(
                shoe.getBrand(),
                shoe.getModel(),
                imageUrl,
                source,
                actorEmail,
                shoe.getRunner()
        );
    }

    public ShoeImageAsset upsertPendingForIdentity(String brand,
                                                   String model,
                                                   String imageUrl,
                                                   String source,
                                                   String actorEmail) {
        return upsertPendingForIdentity(brand, model, imageUrl, source, actorEmail, null);
    }

    private ShoeImageAsset upsertPendingForIdentity(String brand,
                                                    String model,
                                                    String imageUrl,
                                                    String source,
                                                    String actorEmail,
                                                    Runner runner) {
        String identityKey = requireIdentityKey(brand, model);
        ShoeImageAsset asset = shoeImageAssetRepository.findByIdentityKey(identityKey).orElseGet(ShoeImageAsset::new);
        asset.setIdentityKey(identityKey);
        if (asset.getRunner() == null && runner != null) {
            asset.setRunner(runner);
        }
        asset.setBrand(brand);
        asset.setModel(model);
        asset.setPendingImageUrl(imageUrl);
        asset.setPendingSource(source);
        asset.setPendingUpdatedAt(LocalDateTime.now());
        asset.setPendingUpdatedByEmail(actorEmail);
        return shoeImageAssetRepository.save(asset);
    }

    @Transactional
    public ShoeImageAsset acceptPendingForShoe(Shoe shoe, String actorEmail) {
        String identityKey = requireIdentityKey(shoe);
        return acceptPending(identityKey, shoe.getBrand(), shoe.getModel(), actorEmail);
    }

    @Transactional
    public ShoeImageAsset acceptPendingForIdentity(String brand, String model, String actorEmail) {
        String identityKey = requireIdentityKey(brand, model);
        return acceptPending(identityKey, brand, model, actorEmail);
    }

    private ShoeImageAsset acceptPending(String identityKey, String brand, String model, String actorEmail) {
        ShoeImageAsset asset = shoeImageAssetRepository.findByIdentityKey(identityKey)
                .orElseThrow(() -> new IllegalArgumentException("Shoe image asset not found."));
        if (asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("No pending shoe image preview to publish.");
        }
        asset.setLiveImageUrl(asset.getPendingImageUrl());
        asset.setLiveSource(asset.getPendingSource());
        asset.setLiveUpdatedAt(LocalDateTime.now());
        asset.setLiveUpdatedByEmail(actorEmail);
        shoeImageAssetRepository.save(asset);

        List<Shoe> matching = shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase(brand, model);
        for (Shoe item : matching) {
            item.setPhotoUrl(asset.getLiveImageUrl());
            item.setPhotoVerified(true);
        }
        shoeRepository.saveAll(matching);
        return asset;
    }

    public ShoeImageAsset clearPendingForShoe(Shoe shoe) {
        return clearPendingForIdentity(shoe.getBrand(), shoe.getModel());
    }

    public ShoeImageAsset clearPendingForIdentity(String brand, String model) {
        String identityKey = requireIdentityKey(brand, model);
        ShoeImageAsset asset = shoeImageAssetRepository.findByIdentityKey(identityKey)
                .orElseThrow(() -> new IllegalArgumentException("Shoe image asset not found."));
        asset.setPendingImageUrl(null);
        asset.setPendingSource(null);
        asset.setPendingUpdatedAt(null);
        asset.setPendingUpdatedByEmail(null);
        return shoeImageAssetRepository.save(asset);
    }

    public Optional<String> findLiveImageUrl(String brand, String model) {
        return shoeImageAssetRepository.findByIdentityKey(requireIdentityKey(brand, model))
                .map(ShoeImageAsset::getLiveImageUrl)
                .filter(url -> url != null && !url.isBlank());
    }

    public void applyLiveAssetToShoe(Shoe shoe) {
        if (shoe == null) return;
        if (shoe.getIdentityKey() == null || shoe.getIdentityKey().isBlank()) {
            shoeIdentityService.applyIdentityKey(shoe);
        }
        shoeImageAssetRepository.findByIdentityKey(shoe.getIdentityKey())
                .map(ShoeImageAsset::getLiveImageUrl)
                .filter(url -> url != null && !url.isBlank())
                .ifPresent(url -> {
                    if (shoe.getPhotoUrl() == null || shoe.getPhotoUrl().isBlank()) {
                        shoe.setPhotoUrl(url);
                    }
                    shoe.setPhotoVerified(true);
                });
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
        if (shoe == null) {
            throw new IllegalArgumentException("Shoe is required.");
        }
        String identityKey = shoe.getIdentityKey();
        if (identityKey == null || identityKey.isBlank()) {
            throw new IllegalArgumentException("Shoe identity key is required.");
        }
        return identityKey;
    }

    private String requireIdentityKey(String brand, String model) {
        String identityKey = shoeIdentityService.computeIdentityKey(brand, model);
        if ("na".equals(identityKey)) {
            throw new IllegalArgumentException("Brand and model are required.");
        }
        return identityKey;
    }
}
