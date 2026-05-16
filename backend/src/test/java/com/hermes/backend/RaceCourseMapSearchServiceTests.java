package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

class RaceCourseMapSearchServiceTests {

    @Test
    void collectBulkCandidatesUsesBoundedSearchInsteadOfDeepOfficialPageProbing() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        List<String> requestedUrls = new ArrayList<>();
        doAnswer(invocation -> {
            requestedUrls.add(invocation.getArgument(0));
            return ResponseEntity.ok("<html></html>");
        }).when(restTemplate).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        RaceCourseMapSearchService service = new RaceCourseMapSearchService(restTemplate);

        service.collectCandidates(
                "New York City Marathon",
                "New York City",
                "United States",
                "https://www.nyrr.org/tcsnycmarathon",
                42.195
        );

        assertThat(requestedUrls).hasSizeLessThanOrEqualTo(4);
        assertThat(requestedUrls).allMatch(url -> url.contains("https://www.bing.com/images/search"));
    }

    @Test
    void collectBulkCandidatesRejectsSearchImagesWithoutCourseMapUrlSignal() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        doAnswer(invocation -> ResponseEntity.ok("""
                <html>
                  <body>
                    murl&quot;:&quot;https%3A%2F%2Fcdn.example.com%2Frelative-pronouns.jpg&quot;
                    murl&quot;:&quot;https%3A%2F%2Fcdn.example.com%2Fnyc-course-map-2026.jpg&quot;
                  </body>
                </html>
                """))
                .when(restTemplate)
                .exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        RaceCourseMapSearchService service = new RaceCourseMapSearchService(restTemplate);

        var candidates = service.collectCandidates(
                "New York City Marathon",
                "New York City",
                "United States",
                "https://www.nyrr.org/tcsnycmarathon",
                42.195
        );

        assertThat(candidates).containsOnlyKeys("https://cdn.example.com/nyc-course-map-2026.jpg");
    }

    @Test
    void collectBulkCandidatesRejectsHalfMarathonRouteImagesForFullMarathonSearches() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        doAnswer(invocation -> ResponseEntity.ok("""
                <html>
                  <body>
                    murl&quot;:&quot;https%3A%2F%2Fcdn.example.com%2Fmanchester-half-route-2022.jpg&quot;
                    murl&quot;:&quot;https%3A%2F%2Fcdn.example.com%2Fmanchester-marathon-course-map.jpg&quot;
                  </body>
                </html>
                """))
                .when(restTemplate)
                .exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        RaceCourseMapSearchService service = new RaceCourseMapSearchService(restTemplate);

        var candidates = service.collectCandidates(
                "Manchester Marathon",
                "Manchester",
                "United Kingdom",
                "https://www.manchestermarathon.co.uk",
                42.195
        );

        assertThat(candidates).containsOnlyKeys("https://cdn.example.com/manchester-marathon-course-map.jpg");
    }
}
