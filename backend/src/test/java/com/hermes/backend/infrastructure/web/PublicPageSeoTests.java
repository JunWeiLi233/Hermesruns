package com.hermes.backend.infrastructure.web;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.assertThat;

class PublicPageSeoTests {
    @ParameterizedTest
    @CsvSource({"/, Adaptive Running Plans & Analytics | HermesRuns, Run the race you trained for.",
            "/terms, Terms of Service and Use | HermesRuns, Terms of Service",
            "/privacy, Privacy Policy and Data Practices | HermesRuns, Privacy Policy"})
    void initialPublicDocumentHasItsOwnIdentityAndContent(String route, String title, String heading) throws Exception {
        var response = new SpaForwardingController().forward(new MockHttpServletRequest("GET", route));
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getFirst("X-Robots-Tag")).isNull();
        assertThat(response.getBody()).contains("<title>" + title.replace("&", "&amp;") + "</title>")
                .contains("rel=\"canonical\" href=\"https://hermesruns.com" + (route.equals("/") ? "/" : route) + "\"")
                .contains(heading)
                .doesNotContain("<div id=\"root\"></div>");
        assertThat(response.getBody()).contains(route.equals("/")
                ? "id=\"lv3-hero-title\">" + heading + "</h1>"
                : "id=\"legal-document-title\">" + heading + "</h1>");
        if (!route.equals("/")) {
            assertThat(response.getBody()).doesNotContain("Run the race you trained for.");
        }
    }
}
