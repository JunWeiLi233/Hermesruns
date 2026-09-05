package com.hermes.backend.races;

import com.hermes.backend.races.model.CourseMapCandidate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

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

    @Test
    void collectOfficialPageCandidatesFindsOsakaInfoCourseMapBeforeOpenGraphImage() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        doAnswer(invocation -> {
            String url = invocation.getArgument(0, String.class);
            if ("https://www.osaka-marathon.com/2026/en/".equals(url)) {
                return ResponseEntity.ok("""
                        <html>
                          <head>
                            <meta property="og:image" content="/2026/common/img/og.png" />
                          </head>
                          <body>Osaka Marathon 2026</body>
                        </html>
                        """);
            }
            if ("https://www.osaka-marathon.com/2026/en/info/course/".equals(url)) {
                return ResponseEntity.ok("""
                        <html>
                          <body>
                            <img src="img/img_map_en.jpg" alt="Course" />
                            <img src="img/img_map_02_en.jpg" alt="Course elevation map" />
                          </body>
                        </html>
                        """);
            }
            return ResponseEntity.ok("<html><body>No course map here.</body></html>");
        }).when(restTemplate).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        RaceCourseMapSearchService service = new RaceCourseMapSearchService(restTemplate);
        var candidates = new java.util.LinkedHashMap<String, CourseMapCandidate>();

        service.collectOfficialPageCandidates(candidates, "https://www.osaka-marathon.com/2026/en/");

        assertThat(candidates).containsKey("https://www.osaka-marathon.com/2026/en/info/course/img/img_map_en.jpg");
        assertThat(candidates.get("https://www.osaka-marathon.com/2026/en/info/course/img/img_map_en.jpg").score())
                .isGreaterThan(candidates.get("https://www.osaka-marathon.com/2026/common/img/og.png").score());
    }

    @Test
    void collectOfficialPageCandidatesChecksDublinCourseStartFinishPage() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        List<String> requestedUrls = new ArrayList<>();
        doAnswer(invocation -> {
            String url = invocation.getArgument(0, String.class);
            requestedUrls.add(url);
            if ("https://irishlifedublinmarathon.ie/course-and-start-finish/".equals(url)) {
                return ResponseEntity.ok("""
                        <html>
                          <body>
                            <a href="/wp-content/uploads/2026/05/IL_DM26_ROUTE_MAP.pdf">Download 2026 Course Map</a>
                          </body>
                        </html>
                        """);
            }
            return ResponseEntity.ok("<html><body>No course map here.</body></html>");
        }).when(restTemplate).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));

        RaceCourseMapSearchService service = new RaceCourseMapSearchService(restTemplate);
        var candidates = new java.util.LinkedHashMap<String, CourseMapCandidate>();

        service.collectOfficialPageCandidates(candidates, "https://irishlifedublinmarathon.ie/");

        assertThat(requestedUrls).contains("https://irishlifedublinmarathon.ie/course-and-start-finish/");
        assertThat(candidates).containsKey("https://irishlifedublinmarathon.ie/wp-content/uploads/2026/05/IL_DM26_ROUTE_MAP.pdf");
    }
}
