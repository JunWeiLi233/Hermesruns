package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AppRedisProperties {
    private final boolean enabled;
    private final String keyPrefix;

    public AppRedisProperties(
            @Value("${app.redis.enabled:false}") boolean enabled,
            @Value("${app.redis.key-prefix:hermes}") String keyPrefix
    ) {
        this.enabled = enabled;
        this.keyPrefix = keyPrefix == null || keyPrefix.isBlank() ? "hermes" : keyPrefix.trim();
    }

    static AppRedisProperties disabledForTests() {
        return new AppRedisProperties(false, "hermes-test");
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String keyPrefix() {
        return keyPrefix;
    }
}
