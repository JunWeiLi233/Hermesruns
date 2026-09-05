package com.hermes.backend.admin;

public record NoteDto(Long id, Long authorRunnerId, String authorEmail, String createdAt, String noteText) {
}
