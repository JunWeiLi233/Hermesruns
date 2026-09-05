package com.hermes.backend.auth;

import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.Cookie;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class AdminPortalSessionCookieTests {

    @Test
    void secureRequestsIssueStrictHttpOnlySecureCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(true);

        String header = AdminPortalSessionCookie.issue("admin-token", request);

        assertThat(header)
                .contains("hermes_admin_portal=admin-token")
                .contains("Path=/")
                .contains("Max-Age=28800")
                .contains("Secure")
                .contains("HttpOnly")
                .contains("SameSite=Strict");
    }

    @Test
    void malformedCookieValuesAreIgnored() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(AdminPortalSessionCookie.NAME, "bad token"));

        assertThat(AdminPortalSessionCookie.read(request)).isEmpty();
    }

    @Test
    void portalSessionsExpireAfterEightHours() {
        Runner fresh = new Runner();
        fresh.setTokenIssuedAt(LocalDateTime.now().minusHours(7));
        Runner expired = new Runner();
        expired.setTokenIssuedAt(LocalDateTime.now().minusHours(9));

        assertThat(AdminPortalSessionCookie.isFresh(fresh)).isTrue();
        assertThat(AdminPortalSessionCookie.isFresh(expired)).isFalse();
    }
}
