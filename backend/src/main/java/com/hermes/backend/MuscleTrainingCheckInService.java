package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
public class MuscleTrainingCheckInService {

    private final MuscleTrainingCheckInRepository checkInRepository;

    public MuscleTrainingCheckInService(MuscleTrainingCheckInRepository checkInRepository) {
        this.checkInRepository = checkInRepository;
    }

    @Transactional(readOnly = true)
    public TodayCheckInDto getTodayCheckIn(Runner runner) {
        return findTodayCheckIn(runner)
                .map(this::toTodayCheckInDto)
                .orElse(null);
    }

    @Transactional
    public TodayCheckInDto updateTodayCheckIn(Runner runner, TodayCheckInUpdate update) {
        if (update == null) {
            throw new IllegalArgumentException("runType is required.");
        }

        MuscleTrainingCheckIn checkIn = findTodayCheckIn(runner).orElseGet(() -> {
            MuscleTrainingCheckIn created = new MuscleTrainingCheckIn();
            created.setRunner(runner);
            created.setTrainingDate(LocalDate.now());
            return created;
        });

        if (update.runType() == null || update.runType().isBlank()) {
            throw new IllegalArgumentException("runType is required.");
        }
        if (update.entryState() == null || update.entryState().isBlank()) {
            throw new IllegalArgumentException("entryState is required.");
        }
        if (update.distanceKm() != null && update.distanceKm() < 0) {
            throw new IllegalArgumentException("distanceKm must be zero or greater.");
        }
        if (update.durationMinutes() != null && update.durationMinutes() < 0) {
            throw new IllegalArgumentException("durationMinutes must be zero or greater.");
        }

        checkIn.setRunType(parseEnum(MuscleTrainingCheckIn.RunType.class, update.runType(), "runType"));
        checkIn.setEntryState(parseEnum(MuscleTrainingCheckIn.EntryState.class, update.entryState(), "entryState"));
        checkIn.setDistanceKm(update.distanceKm());
        checkIn.setDurationMinutes(update.durationMinutes());

        return toTodayCheckInDto(checkInRepository.save(checkIn));
    }

    @Transactional
    public void clearTodayCheckIn(Runner runner) {
        findTodayCheckIn(runner).ifPresent(checkInRepository::delete);
    }

    public Optional<MuscleTrainingCheckIn> findTodayCheckIn(Runner runner) {
        return checkInRepository.findByRunnerAndTrainingDate(runner, LocalDate.now());
    }

    public TodayCheckInDto toTodayCheckInDto(MuscleTrainingCheckIn checkIn) {
        return new TodayCheckInDto(
                checkIn.getTrainingDate(),
                checkIn.getRunType().name(),
                checkIn.getEntryState().name(),
                checkIn.getDistanceKm(),
                checkIn.getDurationMinutes(),
                checkIn.getUpdatedAt()
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
