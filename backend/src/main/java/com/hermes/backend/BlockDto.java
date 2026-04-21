package com.hermes.backend;

import java.util.List;

public record BlockDto(String title, List<ExerciseDto> exercises) {}
