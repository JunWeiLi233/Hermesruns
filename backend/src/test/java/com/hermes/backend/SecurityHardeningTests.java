package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:security-hardening-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@Transactional
class SecurityHardeningTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RunnerRepository runnerRepository;

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
