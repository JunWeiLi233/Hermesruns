package com.hermes.backend.entertainment;

final class EntertainmentProblem extends RuntimeException {
    final int status;
    final String code;
    EntertainmentProblem(int status,String code,String message) { super(message); this.status=status; this.code=code; }
}
