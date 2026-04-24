package com.hermes.backend;

public record NoteDto(Long id, Long authorRunnerId, String authorEmail, String createdAt, String noteText) {
}
