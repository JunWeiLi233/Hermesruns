package com.hermes.backend.coaching;

/** Published after a provider batch or source preference has actually been saved. */
public record RecoveryUpdatedEvent(Long runnerId) {}
