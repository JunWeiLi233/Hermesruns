package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class WebConfig {
    @Bean
    RestTemplate restTemplate() {
        // Connect + read timeouts were originally 10 s / 30 s. The 30 s read
        // timeout was a tail-latency hazard: every controller that reads from
        // an upstream HTTP API (Open-Meteo dew-point fetch inside the
        // readiness gate, Strava sync, OAuth code-exchange) inherits this
        // bean, so a single slow upstream could block a user-facing
        // controller for half a minute. Open-Meteo archive responses are
        // typically <500 ms; 5 s gives ~10× headroom while capping the
        // worst case to roughly 1/6 of the previous worst case. Connect
        // timeout stays at 5 s — DNS/TCP failures fail fast.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(5_000);
        return new RestTemplate(factory);
    }
}
