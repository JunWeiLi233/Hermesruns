package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class LettaAgentClientTests {

    @Test
    void sendUserMessagePostsToConfiguredLettaAgent() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        LettaAgentClient client = configuredClient(restTemplate);

        server.expect(requestTo("http://letta.local/v1/agents/agent-123/messages"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer letta-token"))
                .andExpect(content().string(containsString("\"role\":\"user\"")))
                .andExpect(content().string(containsString("\"text\":\"Normalize Nike Alphafly\"")))
                .andRespond(withSuccess("""
                        {
                          "messages": [
                            {
                              "message_type": "assistant_message",
                              "content": [
                                {
                                  "type": "text",
                                  "text": "{\\"brand\\":\\"Nike\\",\\"model\\":\\"Alphafly 3\\"}"
                                }
                              ]
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        String response = client.sendUserMessage("Normalize Nike Alphafly");

        assertThat(response).isEqualTo("{\"brand\":\"Nike\",\"model\":\"Alphafly 3\"}");
        server.verify();
    }

    @Test
    void sendUserMessageRequiresConfiguration() {
        LettaAgentClient client = new LettaAgentClient(new RestTemplate(), new ObjectMapper());

        assertThat(client.isConfigured()).isFalse();
        assertThatThrownBy(() -> client.sendUserMessage("hello"))
                .isInstanceOf(AiProviderException.class)
                .hasMessageContaining("Letta AI agent is not configured");
    }

    private static LettaAgentClient configuredClient(RestTemplate restTemplate) {
        LettaAgentClient client = new LettaAgentClient(restTemplate, new ObjectMapper());
        ReflectionTestUtils.setField(client, "baseUrl", "http://letta.local/");
        ReflectionTestUtils.setField(client, "apiKey", "letta-token");
        ReflectionTestUtils.setField(client, "agentId", "agent-123");
        return client;
    }
}
