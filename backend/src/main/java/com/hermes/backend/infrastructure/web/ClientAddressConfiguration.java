package com.hermes.backend.infrastructure.web;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.DispatcherType;
import java.util.EnumSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.server.autoconfigure.servlet.ForwardedHeaderFilterCustomizer;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.filter.ForwardedHeaderFilter;

/**
 * Reads {@code app.security.trusted-proxies} ({@code APP_TRUSTED_PROXIES}) once and hands it to {@link RequestIpResolver}, which
 * the filters and controllers call as plain static code.
 *
 * <p>The default, {@code private}, believes {@code X-Forwarded-For} only from loopback, private and shared addresses: a proxy
 * on the same host, in the same private network or in a platform's internal network. Behind a proxy that connects from a
 * public address, name its range here. An app that is reached directly should say {@code none}. See {@link TrustedProxies}.</p>
 *
 * <p>It also puts {@link ClientAddressFilter} in front of Spring's {@code ForwardedHeaderFilter}, which would otherwise have
 * rewritten the connection's address from a header the client wrote. That filter is registered here, one place later, instead of
 * by Spring Boot; it is the same filter with the same settings.</p>
 */
@Configuration
class ClientAddressConfiguration {

    private static final Logger log = LoggerFactory.getLogger(ClientAddressConfiguration.class);

    private final String setting;

    ClientAddressConfiguration(@Value("${app.security.trusted-proxies:private}") String setting) {
        this.setting = setting;
    }

    @PostConstruct
    void configure() {
        TrustedProxies proxies = TrustedProxies.parse(setting);
        RequestIpResolver.configure(proxies);
        log.info("X-Forwarded-For is believed from: {}", proxies);
    }

    /** Runs first, so that the request is still the one the server received. */
    @Bean
    FilterRegistrationBean<ClientAddressFilter> clientAddressFilter() {
        FilterRegistrationBean<ClientAddressFilter> registration = new FilterRegistrationBean<>(new ClientAddressFilter());
        registration.setDispatcherTypes(EnumSet.of(DispatcherType.REQUEST, DispatcherType.ASYNC, DispatcherType.ERROR));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    /**
     * What {@code server.forward-headers-strategy=framework} registers on its own, a step later than {@link ClientAddressFilter}:
     * the same filter, with the same customizers, in the same dispatches. Spring Boot's registration backs off when there is one
     * of ours. Scheme, host, port and prefix still follow the proxy's headers, as before.
     */
    @Bean
    @ConditionalOnProperty(name = "server.forward-headers-strategy", havingValue = "framework")
    FilterRegistrationBean<ForwardedHeaderFilter> hermesForwardedHeaderFilter(ObjectProvider<ForwardedHeaderFilterCustomizer> customizers) {
        ForwardedHeaderFilter filter = new ForwardedHeaderFilter();
        customizers.ifAvailable(customizer -> customizer.customize(filter));
        FilterRegistrationBean<ForwardedHeaderFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setDispatcherTypes(EnumSet.of(DispatcherType.REQUEST, DispatcherType.ASYNC, DispatcherType.ERROR));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }
}
