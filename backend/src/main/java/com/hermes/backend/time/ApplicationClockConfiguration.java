package com.hermes.backend.time;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Ordinary application time source; alternate Clock beans can be supplied by configuration. */
@Configuration(proxyBeanMethods = false)
public class ApplicationClockConfiguration {
    @Bean
    @ConditionalOnMissingBean(Clock.class)
    Clock applicationClock() {
        return Clock.systemDefaultZone();
    }
}
