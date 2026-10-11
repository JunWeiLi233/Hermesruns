package com.hermes.backend.infrastructure.web;

import java.io.IOException;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the global handler answers for the failures a client can cause. A catch-all that turns every exception into a 500
 * hid three of them: an upload over the limit (BUG-021) and a request with the wrong content type (BUG-024) were told they
 * had broken the server, and a browser that closed the connection mid-answer put a stack trace in the error log.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:api-exception-mapping;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class ApiExceptionMappingTests {

    @Autowired private ApiExceptionLoggingAdvice advice;

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/import/batch");
        request.setRemoteAddr("127.0.0.1");
        return request;
    }

    @Test
    void anUploadOverTheLimitIsA413ThatSaysWhatTheLimitIs() {
        ResponseEntity<?> answer = advice.handleUploadTooLarge(new MaxUploadSizeExceededException(20L * 1024 * 1024), request());

        assertThat(answer.getStatusCode().value()).isEqualTo(413);
        assertThat(answer.getBody().toString()).contains("too large").contains("20MB").contains("FILE_TOO_LARGE");
    }

    @Test
    void aRequestWithTheWrongContentTypeIsA415() {
        ResponseEntity<?> answer = advice.handle(
                new HttpMediaTypeNotSupportedException(MediaType.TEXT_PLAIN, java.util.List.of(MediaType.APPLICATION_JSON)), request());

        assertThat(answer.getStatusCode().value()).isEqualTo(415);
    }

    @Test
    void aClientErrorSpringChoseKeepsItsStatus() {
        ResponseEntity<?> answer = advice.handle(new HttpMediaTypeNotAcceptableException("not acceptable"), request());

        assertThat(answer.getStatusCode().value()).isEqualTo(406);
    }

    @Test
    void aBrowserThatClosedTheConnectionIsNotAServerError() {
        Exception abort = new HttpMessageNotWritableException("Could not write JSON", new ClientAbortException(new IOException("connection reset")));
        Exception notUsable = new AsyncRequestNotUsableException("Response not usable after response errors");

        assertThat(advice.handle(abort, request())).isNull();
        assertThat(advice.handle(notUsable, request())).isNull();
    }

    @Test
    void anythingElseIsStillA500WithoutDetails() {
        ResponseEntity<?> answer = advice.handle(new IllegalStateException("secret detail"), request());

        assertThat(answer.getStatusCode().value()).isEqualTo(500);
        assertThat(answer.getBody().toString()).contains("Server error").doesNotContain("secret detail");
    }
}
