package com.hermes.backend.infrastructure.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ApiErrorHandlingTests {
    private final ApiExceptionLoggingAdvice advice = new ApiExceptionLoggingAdvice(mock(SpaForwardingController.class));

    @Test
    void explicitClientFailureRetainsItsStatus() {
        var result = advice.handleStatus(new ResponseStatusException(HttpStatus.CONFLICT, "Already submitted"), request());
        assertThat(result.getStatusCode().value()).isEqualTo(409);
        assertThat(result.getBody()).isEqualTo(java.util.Map.of("error", "Already submitted"));
    }

    @Test
    void explicitServerFailureDoesNotExposeItsReason() {
        var result = advice.handleStatus(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "provider secret"), request());
        assertThat(result.getStatusCode().value()).isEqualTo(502);
        assertThat(result.getBody()).isEqualTo(java.util.Map.of("error", "Server error"));
    }

    @Test
    void oversizedUploadIs413InsteadOf500() {
        var result = advice.handleOversizedUpload(new MaxUploadSizeExceededException(20_000_000), request());
        assertThat(result.getStatusCode().value()).isEqualTo(413);
    }

    private MockHttpServletRequest request() { return new MockHttpServletRequest("POST", "/api/test"); }
}
