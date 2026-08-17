package com.hermes.backend;

/**
 * Thrown when the upstream weather provider is rate limited (HTTP 429) or the
 * shared Open-Meteo backoff window is active. The weather controller maps this
 * to HTTP 429 so clients can distinguish provider quota exhaustion from a
 * generic provider outage.
 */
public class WeatherProviderRateLimitedException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public WeatherProviderRateLimitedException(String message) {
        super(message);
    }
}
