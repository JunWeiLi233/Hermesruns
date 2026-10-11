package com.hermes.backend.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.ApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.filter.ForwardedHeaderFilter;

/**
 * With {@code server.forward-headers-strategy=framework}, Spring's {@code ForwardedHeaderFilter} makes the connection's address
 * the first one in {@code X-Forwarded-For}. These tests hold the arrangement that keeps that from reaching the limits: the
 * address is written down first, and the one forwarded-header filter runs after it.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:client-address-configuration-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        // The test resources have an application.properties of their own, so the production setting is repeated here.
        "server.forward-headers-strategy=framework"
})
class ClientAddressConfigurationTests {

    @Autowired
    private ApplicationContext context;

    @Test
    void theConnectionIsWrittenDownBeforeTheOneForwardedHeaderFilterCanChangeIt() {
        List<FilterRegistrationBean<?>> registrations = context.getBeansOfType(FilterRegistrationBean.class).values().stream()
                .<FilterRegistrationBean<?>>map(registration -> registration)
                .toList();
        List<FilterRegistrationBean<?>> forwarded = registrations.stream()
                .filter(registration -> registration.getFilter() instanceof ForwardedHeaderFilter)
                .toList();
        List<FilterRegistrationBean<?>> addresses = registrations.stream()
                .filter(registration -> registration.getFilter() instanceof ClientAddressFilter)
                .toList();

        assertThat(forwarded).as("Spring Boot's own registration of the filter backs off for ours, so there is one").hasSize(1);
        assertThat(addresses).hasSize(1);
        assertThat(addresses.get(0).getOrder()).isEqualTo(Ordered.HIGHEST_PRECEDENCE);
        assertThat(forwarded.get(0).getOrder()).isGreaterThan(addresses.get(0).getOrder());
    }

    @Test
    void thereIsNoSecondForwardedHeaderFilterThatSpringWouldRegisterInFrontOfOurs() {
        assertThat(context.getBeansOfType(ForwardedHeaderFilter.class)).isEmpty();
    }
}
