package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RaceElevationProfileServiceTests {

    @Test
    void resolveProfileReturnsEmptyWhenOfficialPageImageIsNotARealElevationChart() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] blankImage = blankPng();

        when(restTemplate.exchange(
                eq("https://www.marathon.tokyo/en/"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok("""
                <html>
                  <body>
                    <img src="/assets/course-profile.png" />
                  </body>
                </html>
                """));

        when(restTemplate.exchange(
                eq("https://www.marathon.tokyo/assets/course-profile.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(blankImage));

        RaceElevationProfileService service = new RaceElevationProfileService(restTemplate);

        RaceElevationProfileService.RaceElevationProfileResult result = service.resolveProfile(
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/"
        );

        assertThat(result.imageUrl()).isEmpty();
        assertThat(result.profileSamples()).isEmpty();
        assertThat(result.source()).isEmpty();
    }

    @Test
    void resolveProfileRejectsSearchFallbackImageWhenNoProfileCanBeInterpreted() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] blankImage = blankPng();

        when(restTemplate.exchange(
                eq("https://example.com/race"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok("<html><body>No profile here.</body></html>"));

        when(restTemplate.exchange(
                eq("https://www.bing.com/images/search?q=Example+Marathon+marathon+elevation+profile&first=1"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok("""
                murl&quot;:&quot;https%3A%2F%2Fcdn.example.com%2Fcourse-profile.png&quot;
                """));

        when(restTemplate.exchange(
                eq("https://cdn.example.com/course-profile.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(blankImage));

        RaceElevationProfileService service = new RaceElevationProfileService(restTemplate);

        RaceElevationProfileService.RaceElevationProfileResult result = service.resolveProfile(
                "Example Marathon",
                "Example City",
                "United States",
                "https://example.com/race"
        );

        assertThat(result.imageUrl()).isEmpty();
        assertThat(result.profileSamples()).isEmpty();
        assertThat(result.source()).isEmpty();
    }

    private byte[] blankPng() throws Exception {
        BufferedImage image = new BufferedImage(480, 240, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
