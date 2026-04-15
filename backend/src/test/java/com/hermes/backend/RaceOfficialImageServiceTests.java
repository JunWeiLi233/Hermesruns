package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RaceOfficialImageServiceTests {

    @Test
    void resolveOfficialImageRejectsHttpImageCandidates() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/race"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok("""
                <html>
                  <head>
                    <meta property="og:image" content="http://cdn.example.com/banner.jpg" />
                  </head>
                </html>
                """));

        RaceOfficialImageService service = new RaceOfficialImageService(restTemplate);

        assertThat(service.resolveOfficialImage("https://example.com/race")).isNull();
    }

    @Test
    void resolveOfficialImageSkipsHttpCandidateAndUsesLaterHttpsImage() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/race"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok("""
                <html>
                  <head>
                    <meta property="og:image" content="http://cdn.example.com/banner.jpg" />
                    <meta property="twitter:image" content="https://cdn.example.com/hero.jpg" />
                  </head>
                </html>
                """));

        RaceOfficialImageService service = new RaceOfficialImageService(restTemplate);

        assertThat(service.resolveOfficialImage("https://example.com/race"))
                .isEqualTo("https://cdn.example.com/hero.jpg");
    }
}
