package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.time.DayOfWeek;

@Service
public class MuscleTrainingProfileService {

    private final MuscleTrainingPreferenceRepository preferenceRepository;

    public MuscleTrainingProfileService(MuscleTrainingPreferenceRepository preferenceRepository) {
        this.preferenceRepository = preferenceRepository;
    }

    @Transactional
    public MuscleProfileDto getProfile(Runner runner) {
        MuscleTrainingPreference preference = getOrCreatePreference(runner);
        return toProfileDto(preference);
    }

    @Transactional
    public MuscleProfileDto updateProfile(Runner runner, MuscleProfileUpdate update) {
        MuscleTrainingPreference preference = getOrCreatePreference(runner);

        if (update.experienceLevel() != null) {
            preference.setExperienceLevel(parseEnum(MuscleTrainingPreference.ExperienceLevel.class, update.experienceLevel(), "experienceLevel"));
        }
        if (update.equipmentLevel() != null) {
            preference.setEquipmentLevel(parseEnum(MuscleTrainingPreference.EquipmentLevel.class, update.equipmentLevel(), "equipmentLevel"));
        }
        if (update.sessionMinutes() != null) {
            if (update.sessionMinutes() < 10 || update.sessionMinutes() > 120) {
                throw new IllegalArgumentException("sessionMinutes must be between 10 and 120.");
            }
            preference.setSessionMinutes(update.sessionMinutes());
        }
        if (update.noisePreference() != null) {
            preference.setNoisePreference(parseEnum(MuscleTrainingPreference.NoisePreference.class, update.noisePreference(), "noisePreference"));
        }
        if (update.preferredStrengthDays() != null) {
            preference.getPreferredStrengthDays().clear();
            for (String dayStr : update.preferredStrengthDays()) {
                preference.getPreferredStrengthDays().add(parseEnum(DayOfWeek.class, dayStr, "preferredStrengthDays"));
            }
        }

        preference.touch();
        return toProfileDto(preferenceRepository.save(preference));
    }

    public MuscleTrainingPreference getOrCreatePreference(Runner runner) {
        return preferenceRepository.findByRunner(runner).orElseGet(() -> {
            MuscleTrainingPreference created = new MuscleTrainingPreference();
            created.setRunner(runner);
            return preferenceRepository.save(created);
        });
    }

    private MuscleProfileDto toProfileDto(MuscleTrainingPreference p) {
        return new MuscleProfileDto(
                p.getExperienceLevel().name(),
                p.getEquipmentLevel().name(),
                p.getSessionMinutes(),
                p.getNoisePreference().name(),
                p.getPreferredStrengthDays().stream()
                        .sorted(java.util.Comparator.comparingInt(DayOfWeek::getValue))
                        .map(Enum::name)
                        .toList()
        );
    }

    private <T extends Enum<T>> T parseEnum(Class<T> enumType, String value, String fieldName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(enumType, value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid value for " + fieldName + ": " + value);
        }
    }
}
