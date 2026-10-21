package com.hermes.backend.infrastructure.web;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPInputStream;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:hardening_http;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop", "app.local-shared-runner.enabled=false",
        "app.official-course.startup-seed.enabled=false", "strava.sync.enabled=false",
        "app.coach.nightly.enabled=false", "app.security.force-https=false",
        "server.compression.enabled=true", "server.compression.min-response-size=1024"
})
class OperationalHttpTests {
    @LocalServerPort private int port;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private AuthService auth;

    @Test
    void simultaneousSignedInUsersOnlyReceiveTheirOwnActivity() throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var requests = new ArrayList<CompletableFuture<HttpResponse<String>>>();
        var prepared = new ArrayList<HttpRequest>();
        var expectedIds = new ArrayList<Long>();
        for (int i = 0; i < 12; i++) {
            String token = java.util.UUID.randomUUID().toString();
            Runner runner = new Runner(); runner.setEmail("concurrency-" + token + "@example.test");
            runner.setSessionToken(auth.hashPlainToken(token)); runner.setTokenIssuedAt(java.time.LocalDateTime.now());
            runner = runners.saveAndFlush(runner);
            Activity activity = new Activity(); activity.setRunner(runner); activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(5.0);
            activity = activities.saveAndFlush(activity);
            for (int read = 0; read < 2; read++) {
                expectedIds.add(activity.getId());
                prepared.add(HttpRequest.newBuilder(uri("/api/activities?limit=10"))
                        .timeout(Duration.ofSeconds(15)).header("Authorization", "Bearer " + token).GET().build());
            }
        }
        for (HttpRequest request : prepared) {
            requests.add(client.sendAsync(request, HttpResponse.BodyHandlers.ofString()));
        }
        CompletableFuture.allOf(requests.toArray(CompletableFuture[]::new)).get(20, TimeUnit.SECONDS);
        ObjectMapper json = new ObjectMapper();
        for (int i = 0; i < requests.size(); i++) {
            var response = requests.get(i).join();
            assertThat(response.statusCode()).isEqualTo(200);
            var body = json.readTree(response.body());
            assertThat(body.size()).isEqualTo(1);
            assertThat(body.get(0).get("id").asLong()).isEqualTo(expectedIds.get(i));
        }
    }

    @Test
    void simultaneousHttpClientsReachRealAnonymousDatabaseReadiness() throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var requests = new ArrayList<CompletableFuture<HttpResponse<String>>>();
        for (int i = 0; i < 24; i++) {
            requests.add(client.sendAsync(HttpRequest.newBuilder(uri("/internal/ready"))
                    .timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofString()));
        }
        CompletableFuture.allOf(requests.toArray(CompletableFuture[]::new)).get(15, TimeUnit.SECONDS);
        for (var future : requests) {
            var response = future.join();
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo("{\"status\":\"UP\"}");
            assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
        }
    }

    @Test
    void staticAssetIsCompressedWhenClientAcceptsGzip() throws Exception {
        var response = HttpClient.newHttpClient().send(HttpRequest.newBuilder(uri("/assets/operational-gzip-probe.css"))
                .timeout(Duration.ofSeconds(10)).header("Accept-Encoding", "gzip").GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Content-Encoding")).contains("gzip");
        try (var gzip = new GZIPInputStream(new ByteArrayInputStream(response.body()))) {
            assertThat(new String(gzip.readAllBytes(), StandardCharsets.UTF_8)).contains(".operational-probe-47");
        }
    }

    private URI uri(String path) { return URI.create("http://127.0.0.1:" + port + path); }
}
