package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShoeImageAssetServiceTests {

    @Test
    void acceptPendingForShoePublishesLiveImageAcrossMatchingShoes() {
        ShoeImageAssetRepository assetRepository = mock(ShoeImageAssetRepository.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        ShoeImageAssetService service = new ShoeImageAssetService(assetRepository, shoeRepository);

        Shoe shoe = shoe(1L, "nike-pegasus-41");
        Shoe matching = shoe(2L, "nike-pegasus-41");

        ShoeImageAsset asset = new ShoeImageAsset();
        asset.setIdentityKey("nike-pegasus-41");
        asset.setPendingImageUrl("https://cdn.example.com/pending.png");
        asset.setPendingSource("bing-search");

        when(assetRepository.findByIdentityKey("nike-pegasus-41")).thenReturn(Optional.of(asset));
        when(shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase("Nike", "Pegasus 41")).thenReturn(List.of(shoe, matching));
        when(assetRepository.save(any(ShoeImageAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ShoeImageAsset saved = service.acceptPendingForShoe(shoe, "admin@hermes.test");

        assertThat(saved.getLiveImageUrl()).isEqualTo("https://cdn.example.com/pending.png");
        assertThat(saved.getLiveSource()).isEqualTo("bing-search");
        assertThat(shoe.getPhotoUrl()).isEqualTo("https://cdn.example.com/pending.png");
        assertThat(matching.getPhotoUrl()).isEqualTo("https://cdn.example.com/pending.png");
        assertThat(shoe.isPhotoVerified()).isTrue();
        assertThat(matching.isPhotoVerified()).isTrue();
        verify(shoeRepository).saveAll(List.of(shoe, matching));
    }

    @Test
    void acceptPendingForShoePreservesExistingRunnerOwnershipOnSharedAsset() {
        ShoeImageAssetRepository assetRepository = mock(ShoeImageAssetRepository.class);
        ShoeRepository shoeRepository = mock(ShoeRepository.class);
        ShoeImageAssetService service = new ShoeImageAssetService(assetRepository, shoeRepository);

        Runner owner = new Runner();
        owner.setId(11L);
        Runner differentRunner = new Runner();
        differentRunner.setId(22L);

        Shoe shoe = shoe(1L, "nike-pegasus-41");
        shoe.setRunner(differentRunner);

        ShoeImageAsset asset = new ShoeImageAsset();
        asset.setIdentityKey("nike-pegasus-41");
        asset.setRunner(owner);
        asset.setPendingImageUrl("https://cdn.example.com/pending.png");
        asset.setPendingSource("bing-search");

        when(assetRepository.findByIdentityKey("nike-pegasus-41")).thenReturn(Optional.of(asset));
        when(shoeRepository.findByBrandIgnoreCaseAndModelIgnoreCase("Nike", "Pegasus 41")).thenReturn(List.of(shoe));
        when(assetRepository.save(any(ShoeImageAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ShoeImageAsset saved = service.acceptPendingForShoe(shoe, "admin@hermes.test");

        assertThat(saved.getRunner()).isSameAs(owner);
    }

    private Shoe shoe(Long id, String identityKey) {
        Shoe shoe = new Shoe();
        shoe.setId(id);
        shoe.setBrand("Nike");
        shoe.setModel("Pegasus 41");
        shoe.setIdentityKey(identityKey);
        return shoe;
    }
}
