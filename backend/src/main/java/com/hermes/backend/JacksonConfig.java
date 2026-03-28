package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot 4 + spring-boot-starter-webmvc does not register a Jackson {@link ObjectMapper} bean
 * for constructor injection. Garmin and other services expect {@code ObjectMapper} here.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
