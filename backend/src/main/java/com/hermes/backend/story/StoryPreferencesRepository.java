package com.hermes.backend.story;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoryPreferencesRepository extends JpaRepository<StoryPreferences, Long> {
    Optional<StoryPreferences> findByRunnerId(Long runnerId);
}
