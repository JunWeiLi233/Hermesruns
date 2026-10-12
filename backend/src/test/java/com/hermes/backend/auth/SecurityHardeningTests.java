package com.hermes.backend.auth;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.coaching.CoachRunnerStateRepository;
import com.hermes.backend.coaching.CoachScheduledWorkoutRepository;
import com.hermes.backend.coaching.CoachTrainingBlockRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.shoes.ShoeRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:security-hardening-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        // As in production: Spring's ForwardedHeaderFilter is in the chain, and rewrites the connection's address from a header.
        "server.forward-headers-strategy=framework"
})
@Transactional
class SecurityHardeningTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RunnerRepository runnerRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private ShoeRepository shoeRepository;

    @Autowired
    private CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;

    @Autowired
    private CoachTrainingBlockRepository coachTrainingBlockRepository;

    @Autowired
    private CoachRunnerStateRepository coachRunnerStateRepository;

    @Autowired
    private AuthService authService;

    @BeforeEach
    void resetData() {
        coachScheduledWorkoutRepository.deleteAll();
        coachTrainingBlockRepository.deleteAll();
        coachRunnerStateRepository.deleteAll();
        activityRepository.deleteAll();
        shoeRepository.deleteAll();
        runnerRepository.deleteAll();
    }

    @Test
    void loginRejectsUnexpectedFields() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"runner@test.local","password":"Password1!","role":"ADMIN"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("Unexpected fields")));
    }

    @Test
    void createShoeRejectsUnexpectedFields() throws Exception {
        Runner runner = createRunner("runner@test.local", "USER");

        mockMvc.perform(post("/api/shoes")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"brand":"Nike","model":"Pegasus 41","admin":true}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(org.hamcrest.Matchers.containsString("Unexpected fields")));
    }

    @Test
    void ipRateLimitReturnsGraceful429() throws Exception {
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/auth/password-rules")
                            .header("X-Forwarded-For", "198.51.100.10"))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/auth/password-rules")
                        .header("X-Forwarded-For", "198.51.100.10"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
                .andExpect(jsonPath("$.retryAfterSeconds").value(60));
    }

    @Test
    void aStrangersForwardedForDoesNotGiveItAFreshLimitOnEveryRequest() throws Exception {
        // The connection is from 198.51.100.77, which is nobody's proxy. Each request names a different address in the header.
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/auth/password-rules")
                            .with(from("198.51.100.77"))
                            .header("X-Forwarded-For", "10.5.5." + i))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/auth/password-rules")
                        .with(from("198.51.100.77"))
                        .header("X-Forwarded-For", "10.5.5.200"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        // Another connection is another client.
        mockMvc.perform(get("/api/auth/password-rules").with(from("198.51.100.78")))
                .andExpect(status().isOk());
    }

    @Test
    void behindOurProxyTheLimitIsOfTheClientTheProxyAddedWhateverTheClientWroteInFront() throws Exception {
        // The proxy is 10.0.0.5; the client is 198.51.100.150 and writes a new address in front of the one the proxy added each time.
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get("/api/auth/password-rules")
                            .with(from("10.0.0.5"))
                            .header("X-Forwarded-For", "192.0.2." + i + ", 198.51.100.150"))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/auth/password-rules")
                        .with(from("10.0.0.5"))
                        .header("X-Forwarded-For", "192.0.2.250, 198.51.100.150"))
                .andExpect(status().isTooManyRequests());
        // Somebody else behind the same proxy is not held back by it.
        mockMvc.perform(get("/api/auth/password-rules")
                        .with(from("10.0.0.5"))
                        .header("X-Forwarded-For", "198.51.100.151"))
                .andExpect(status().isOk());
    }

    @Test
    void theConnectionsOwnAddressIsKeptWhateverSpringDoesWithTheForwardedHeader() throws Exception {
        // With server.forward-headers-strategy=framework, request.getRemoteAddr() answers with the first X-Forwarded-For address,
        // and the header is gone. The resolver reads the address the filter that runs first wrote down.
        org.springframework.test.web.servlet.MvcResult result = mockMvc.perform(get("/api/auth/password-rules")
                        .with(from("198.51.100.79"))
                        .header("X-Forwarded-For", "10.7.7.7"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getRequest().getAttribute("com.hermes.backend.infrastructure.web.RequestIpResolver.peer"))
                .isEqualTo("198.51.100.79");
    }

    @Test
    void loginPageStravaStatusIsPublicBeforeSessionExists() throws Exception {
        mockMvc.perform(get("/api/auth/strava/status")
                        .header("X-Forwarded-For", "198.51.100.20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(false))
                .andExpect(jsonPath("$.autoUpdateMode").value("webhook_retry_burst_then_on_open_catch_up"));
    }

    @Test
    void authenticatedUserRateLimitAppliesAcrossIps() throws Exception {
        Runner runner = createRunner("user-limit@test.local", "USER");
        String bearer = bearer(runner);

        for (int i = 0; i < 90; i++) {
            mockMvc.perform(get("/api/auth/password-rules")
                            .header("Authorization", bearer)
                            .header("X-Forwarded-For", "203.0.113." + i))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/auth/password-rules")
                        .header("Authorization", bearer)
                        .header("X-Forwarded-For", "203.0.113.200"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    /** Makes the request come over a connection from {@code address}. */
    private static org.springframework.test.web.servlet.request.RequestPostProcessor from(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private Runner createRunner(String email, String role) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setRole(role);
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(true);
        runner.setCreatedAt(LocalDateTime.now());
        authService.storePassword(runner, "Password1!");
        Runner saved = runnerRepository.save(runner);
        assertThat(saved.getId()).isNotNull();
        return saved;
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }
}
