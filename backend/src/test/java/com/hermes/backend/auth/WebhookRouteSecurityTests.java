package com.hermes.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Strava and Stripe call back without a Hermes session. The security rules for those two paths must
 * match the controllers' real paths, or the provider gets a 401 before the controller ever runs. They
 * did not match: the rules named /api/auth/strava/webhook and /api/billing/stripe/webhook, which no
 * controller serves, so neither webhook could ever be delivered.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:webhook-route-security;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver"
})
@AutoConfigureMockMvc
class WebhookRouteSecurityTests {

    private static final String SESSION_REQUIRED = "Invalid or expired session token.";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void stravaSubscriptionValidationReachesTheControllerWithoutASession() throws Exception {
        // The controller answers 403 {"error":"Forbidden"}; a security rejection would be 401 with the session message.
        mockMvc.perform(get("/api/strava/webhook")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "not-the-token")
                        .param("hub.challenge", "abc"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Forbidden"));
    }

    @Test
    void stravaEventDeliveryReachesTheControllerWithoutASession() throws Exception {
        mockMvc.perform(post("/api/strava/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("this is not json"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("INVALID_JSON"));
    }

    @Test
    void stripeWebhookReachesTheControllerWithoutASession() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/billing/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andReturn();

        assertThat(result.getResponse().getStatus())
                .as("the Stripe webhook must reach its controller, which verifies the Stripe signature itself")
                .isNotEqualTo(401);
        assertThat(result.getResponse().getContentAsString()).doesNotContain(SESSION_REQUIRED);
    }

    @Test
    void theOldMisspelledWebhookPathsAreNotOpenedByTheRule() throws Exception {
        mockMvc.perform(post("/api/auth/strava/webhook").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/billing/stripe/webhook").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void disconnectingStravaStillRequiresASession() throws Exception {
        mockMvc.perform(delete("/api/auth/strava/unlink"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(SESSION_REQUIRED));
    }

    @Test
    void openingTheWebhooksDidNotOpenTheRestOfTheStravaRoutes() throws Exception {
        mockMvc.perform(get("/api/strava/sync")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/billing/checkout").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
