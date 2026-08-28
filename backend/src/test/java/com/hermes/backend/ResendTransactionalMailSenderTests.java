package com.hermes.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ResendTransactionalMailSenderTests {

    private static final String API_KEY = "test-resend-api-key";
    private static final String FROM = "Hermes <mailer@example.test>";
    private static final String REPLY_TO = "support@example.test";
    private static final TransactionalMailMessage MESSAGE = new TransactionalMailMessage(
            "runner@example.test", "欢迎", "Plain body 你好", "<p>HTML body 你好</p>", "request-123");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private LocalResendServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = new LocalResendServer();
    }

    @AfterEach
    void stopServer() {
        server.close();
    }

    @Test
    void returnsProviderIdAndPostsExpectedHeadersAndPayload() throws Exception {
        server.respond(200, "{\"id\":\"email-123\"}");

        MailDeliveryReceipt receipt = sender().send(MESSAGE);

        assertThat(receipt.providerMessageId()).isEqualTo("email-123");
        assertThat(server.requests()).hasSize(1);
        RecordedRequest request = server.requests().get(0);
        assertThat(request.method()).isEqualTo("POST");
        assertThat(request.authorization()).isEqualTo("Bearer " + API_KEY);
        assertThat(request.contentType()).startsWith("application/json");
        assertThat(request.idempotencyKey()).isEqualTo(MESSAGE.idempotencyKey());
        JsonNode payload = objectMapper.readTree(request.body());
        assertThat(payload.path("from").asText()).isEqualTo(FROM);
        assertThat(payload.path("to")).hasSize(1);
        assertThat(payload.path("to").get(0).asText()).isEqualTo(MESSAGE.to());
        assertThat(payload.path("subject").asText()).isEqualTo(MESSAGE.subject());
        assertThat(payload.path("text").asText()).isEqualTo(MESSAGE.text());
        assertThat(payload.path("html").asText()).isEqualTo(MESSAGE.html());
        assertThat(payload.path("reply_to").asText()).isEqualTo(REPLY_TO);
    }

    @Test
    void retriesOnceAfterRateLimitWithTheSameIdempotencyKey() {
        server.respond(429, "{\"message\":\"slow down\"}");
        server.respond(200, "{\"id\":\"email-after-rate-limit\"}");

        MailDeliveryReceipt receipt = sender().send(MESSAGE);

        assertThat(receipt.providerMessageId()).isEqualTo("email-after-rate-limit");
        assertThat(server.requests()).hasSize(2);
        assertThat(server.requests()).extracting(RecordedRequest::idempotencyKey)
                .containsExactly(MESSAGE.idempotencyKey(), MESSAGE.idempotencyKey());
    }

    @Test
    void retriesOnceAfterServerError() {
        server.respond(500, "{\"message\":\"unavailable\"}");
        server.respond(200, "{\"id\":\"email-after-server-error\"}");

        assertThat(sender().send(MESSAGE).providerMessageId()).isEqualTo("email-after-server-error");
        assertThat(server.requests()).hasSize(2);
    }

    @Test
    void doesNotRetryStatusOutsideTheFiveHundreds() {
        server.respond(600, "{\"message\":\"outside HTTP retry range\"}");
        server.respond(200, "{\"id\":\"must-not-be-used\"}");

        assertThatThrownBy(() -> sender().send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail provider rejected the request")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isEqualTo(600);
                    assertThat(exception.isRetryable()).isFalse();
                });
        assertThat(server.requests()).hasSize(1);
    }

    @Test
    void doesNotRetryClientError() {
        server.respond(400, "provider response body must stay private");

        assertThatThrownBy(() -> sender().send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail provider rejected the request")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isEqualTo(400);
                    assertThat(exception.isRetryable()).isFalse();
                });
        assertThat(server.requests()).hasSize(1);
    }

    @Test
    void marksTwoServerErrorsRetryableAfterExactlyTwoAttempts() {
        server.respond(500, "{\"message\":\"first failure\"}");
        server.respond(500, "{\"message\":\"second failure\"}");

        assertThatThrownBy(() -> sender().send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail provider is temporarily unavailable")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isEqualTo(500);
                    assertThat(exception.isRetryable()).isTrue();
                });
        assertThat(server.requests()).hasSize(2);
    }

    @Test
    void rejectsSuccessfulResponseWithoutNonblankProviderId() {
        server.respond(200, "{\"id\":\"  \"}");

        assertThatThrownBy(() -> sender().send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail provider returned an invalid response")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isEqualTo(200);
                    assertThat(exception.isRetryable()).isFalse();
                });
    }

    @Test
    void rejectsOversizedSuccessfulResponseWithoutReturningItsProviderId() {
        server.respond(200, "{\"id\":\"" + "x".repeat(16 * 1024 + 1) + "\"}");

        assertThatThrownBy(() -> sender().send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail provider returned an invalid response")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isEqualTo(200);
                    assertThat(exception.isRetryable()).isFalse();
                });
        assertThat(server.requests()).hasSize(1);
    }

    @Test
    void timesOutWhenSuccessfulResponseBodyStallsAfterHeaders() throws Exception {
        CountDownLatch headersSent = new CountDownLatch(1);
        CountDownLatch releaseResponse = new CountDownLatch(1);
        CountDownLatch responseClosed = new CountDownLatch(1);
        CountDownLatch cancellationProbeRequested = new CountDownLatch(1);
        CountDownLatch clientCancellationObserved = new CountDownLatch(1);
        server.stallSuccessfulResponseAfterPartialBody(
                headersSent, releaseResponse, responseClosed, cancellationProbeRequested, clientCancellationObserved);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread requestThread = new Thread(() -> {
            try {
                sender(Duration.ofMillis(150)).send(MESSAGE);
            } catch (Throwable throwable) {
                failure.set(throwable);
            }
        });

        requestThread.start();
        try {
            assertThat(headersSent.await(5, TimeUnit.SECONDS)).isTrue();
            requestThread.join(2_000);

            assertThat(requestThread.isAlive()).isFalse();
            assertThat(failure.get()).isExactlyInstanceOf(MailDeliveryException.class);
            MailDeliveryException exception = (MailDeliveryException) failure.get();
            assertThat(exception.getStatusCode()).isEqualTo(200);
            assertThat(exception.isRetryable()).isFalse();
            assertThat(server.requests()).hasSize(1);
            cancellationProbeRequested.countDown();
            assertThat(clientCancellationObserved.await(2, TimeUnit.SECONDS)).isTrue();
        } finally {
            releaseResponse.countDown();
            requestThread.join(5_000);
        }
        assertThat(responseClosed.await(5, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void restoresInterruptStatusWhenSuccessfulResponseBodyStallsAfterHeaders() throws Exception {
        CountDownLatch headersSent = new CountDownLatch(1);
        CountDownLatch clientObservedHeaders = new CountDownLatch(1);
        CountDownLatch releaseResponse = new CountDownLatch(1);
        CountDownLatch responseClosed = new CountDownLatch(1);
        CountDownLatch cancellationProbeRequested = new CountDownLatch(1);
        CountDownLatch clientCancellationObserved = new CountDownLatch(1);
        server.stallSuccessfulResponseAfterPartialBody(
                headersSent, releaseResponse, responseClosed, cancellationProbeRequested, clientCancellationObserved);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        AtomicReference<MailDeliveryReceipt> receipt = new AtomicReference<>();
        AtomicBoolean interrupted = new AtomicBoolean();
        Thread requestThread = new Thread(() -> {
            try {
                receipt.set(sender(Duration.ofSeconds(5), new HeaderObservingHttpClient(
                        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), clientObservedHeaders))
                        .send(MESSAGE));
            } catch (Throwable throwable) {
                failure.set(throwable);
                interrupted.set(Thread.currentThread().isInterrupted());
            }
        });

        requestThread.start();
        try {
            assertThat(headersSent.await(5, TimeUnit.SECONDS)).isTrue();
            assertThat(clientObservedHeaders.await(5, TimeUnit.SECONDS)).isTrue();
            requestThread.interrupt();
            requestThread.join(2_000);

            assertThat(requestThread.isAlive()).isFalse();
            assertThat(receipt.get()).isNull();
            assertThat(failure.get()).isExactlyInstanceOf(MailDeliveryException.class);
            MailDeliveryException exception = (MailDeliveryException) failure.get();
            assertThat(exception.getStatusCode()).isEqualTo(200);
            assertThat(exception.isRetryable()).isFalse();
            assertThat(interrupted).isTrue();
            assertThat(server.requests()).hasSize(1);
            cancellationProbeRequested.countDown();
            assertThat(clientCancellationObserved.await(2, TimeUnit.SECONDS)).isTrue();
        } finally {
            releaseResponse.countDown();
            requestThread.join(5_000);
        }
        assertThat(responseClosed.await(5, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void rejectsUnconfiguredAdapterBeforeMakingARequest() {
        ResendTransactionalMailSender sender = new ResendTransactionalMailSender(
                HttpClient.newHttpClient(), objectMapper, server.endpoint(), " ", FROM, REPLY_TO);

        assertThat(sender.isConfigured()).isFalse();
        assertThatThrownBy(() -> sender.send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail is not configured")
                .satisfies(error -> assertThat(((MailDeliveryException) error).isRetryable()).isFalse());
        assertThat(server.requests()).isEmpty();
    }

    @Test
    void rejectsInvalidMessageBeforeMakingARequest() {
        TransactionalMailMessage invalid = new TransactionalMailMessage(
                MESSAGE.to(), MESSAGE.subject(), " ", MESSAGE.html(), MESSAGE.idempotencyKey());

        assertThatThrownBy(() -> sender().send(invalid))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail request is invalid")
                .satisfies(error -> assertThat(((MailDeliveryException) error).isRetryable()).isFalse());
        assertThat(server.requests()).isEmpty();
    }

    @Test
    void rejectsMalformedApiKeyBeforeMakingARequestWithoutRetainingIt() {
        String marker = "api-key-secret-marker";
        ResendTransactionalMailSender sender = sender(Duration.ofSeconds(10),
                HttpClient.newHttpClient(), "key-" + marker + "\ncontrol");

        assertThatThrownBy(() -> sender.send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail request is invalid")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isNull();
                    assertThat(exception.isRetryable()).isFalse();
                    assertThat(exception.getCause()).isNull();
                    assertThat(exception.getMessage()).doesNotContain(marker);
                });
        assertThat(server.requests()).isEmpty();
    }

    @Test
    void rejectsMalformedIdempotencyKeyBeforeMakingARequestWithoutRetainingIt() {
        String marker = "idempotency-secret-marker";
        TransactionalMailMessage malformed = new TransactionalMailMessage(
                MESSAGE.to(), MESSAGE.subject(), MESSAGE.text(), MESSAGE.html(), "request-" + marker + "\rcontrol");

        assertThatThrownBy(() -> sender().send(malformed))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .hasMessage("Transactional mail request is invalid")
                .satisfies(error -> {
                    MailDeliveryException exception = (MailDeliveryException) error;
                    assertThat(exception.getStatusCode()).isNull();
                    assertThat(exception.isRetryable()).isFalse();
                    assertThat(exception.getCause()).isNull();
                    assertThat(exception.getMessage()).doesNotContain(marker);
                });
        assertThat(server.requests()).isEmpty();
    }

    @Test
    void neverLeaksSensitiveValuesInExceptionMessages() {
        String providerResponse = "provider response body must stay private";
        server.respond(400, providerResponse);

        assertThatThrownBy(() -> sender().send(MESSAGE))
                .isExactlyInstanceOf(MailDeliveryException.class)
                .satisfies(error -> assertThat(error.getMessage())
                        .doesNotContain(API_KEY, MESSAGE.to(), MESSAGE.text(), MESSAGE.html(), providerResponse));
    }

    @Test
    void restoresInterruptStatusWhenRequestIsInterrupted() throws Exception {
        CountDownLatch requestStarted = new CountDownLatch(1);
        CountDownLatch releaseHandler = new CountDownLatch(1);
        server.blockResponseUntil(requestStarted, releaseHandler);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        AtomicBoolean interrupted = new AtomicBoolean();
        Thread requestThread = new Thread(() -> {
            try {
                sender().send(MESSAGE);
            } catch (Throwable throwable) {
                failure.set(throwable);
                interrupted.set(Thread.currentThread().isInterrupted());
            }
        });

        requestThread.start();
        assertThat(requestStarted.await(5, TimeUnit.SECONDS)).isTrue();
        requestThread.interrupt();
        requestThread.join(5_000);
        releaseHandler.countDown();

        assertThat(requestThread.isAlive()).isFalse();
        assertThat(failure.get()).isExactlyInstanceOf(MailDeliveryException.class);
        MailDeliveryException exception = (MailDeliveryException) failure.get();
        assertThat(exception.getMessage()).isEqualTo("Transactional mail provider is temporarily unavailable");
        assertThat(exception.isRetryable()).isTrue();
        assertThat(interrupted).isTrue();
    }

    private ResendTransactionalMailSender sender() {
        return sender(Duration.ofSeconds(10));
    }

    private ResendTransactionalMailSender sender(Duration requestTimeout) {
        return sender(requestTimeout, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    private ResendTransactionalMailSender sender(Duration requestTimeout, HttpClient httpClient) {
        return sender(requestTimeout, httpClient, API_KEY);
    }

    private ResendTransactionalMailSender sender(Duration requestTimeout, HttpClient httpClient, String apiKey) {
        return new ResendTransactionalMailSender(
                httpClient,
                objectMapper,
                server.endpoint(),
                apiKey,
                FROM,
                REPLY_TO,
                requestTimeout);
    }

    private record RecordedRequest(String method, String authorization, String contentType, String idempotencyKey, String body) {
    }

    private static final class HeaderObservingHttpClient extends HttpClient {

        private final HttpClient delegate;
        private final CountDownLatch successfulHeadersObserved;

        private HeaderObservingHttpClient(HttpClient delegate, CountDownLatch successfulHeadersObserved) {
            this.delegate = delegate;
            this.successfulHeadersObserved = successfulHeadersObserved;
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return delegate.cookieHandler();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return delegate.connectTimeout();
        }

        @Override
        public Redirect followRedirects() {
            return delegate.followRedirects();
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return delegate.proxy();
        }

        @Override
        public SSLContext sslContext() {
            return delegate.sslContext();
        }

        @Override
        public SSLParameters sslParameters() {
            return delegate.sslParameters();
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return delegate.authenticator();
        }

        @Override
        public Version version() {
            return delegate.version();
        }

        @Override
        public Optional<Executor> executor() {
            return delegate.executor();
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException, InterruptedException {
            return delegate.send(request, responseBodyHandler);
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            return delegate.sendAsync(request, observing(responseBodyHandler));
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            return delegate.sendAsync(request, observing(responseBodyHandler), pushPromiseHandler);
        }

        private <T> HttpResponse.BodyHandler<T> observing(HttpResponse.BodyHandler<T> responseBodyHandler) {
            return responseInfo -> {
                HttpResponse.BodySubscriber<T> subscriber = responseBodyHandler.apply(responseInfo);
                if (responseInfo.statusCode() >= 200 && responseInfo.statusCode() < 300) {
                    successfulHeadersObserved.countDown();
                }
                return subscriber;
            };
        }
    }

    private static final class LocalResendServer implements AutoCloseable {

        private final HttpServer server;
        private final Queue<Response> responses = new ConcurrentLinkedQueue<>();
        private final List<RecordedRequest> requests = new CopyOnWriteArrayList<>();
        private volatile CountDownLatch requestStarted;
        private volatile CountDownLatch releaseHandler;
        private volatile CountDownLatch partialBodyHeadersSent;
        private volatile CountDownLatch releasePartialBody;
        private volatile CountDownLatch partialBodyResponseClosed;
        private volatile CountDownLatch cancellationProbeRequested;
        private volatile CountDownLatch clientCancellationObserved;

        private LocalResendServer() throws IOException {
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            server.createContext("/emails", this::handle);
            server.start();
        }

        URI endpoint() {
            return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/emails");
        }

        List<RecordedRequest> requests() {
            return requests;
        }

        void respond(int status, String body) {
            responses.add(new Response(status, body));
        }

        void blockResponseUntil(CountDownLatch requestStarted, CountDownLatch releaseHandler) {
            this.requestStarted = requestStarted;
            this.releaseHandler = releaseHandler;
        }

        void stallSuccessfulResponseAfterPartialBody(
                CountDownLatch headersSent,
                CountDownLatch releaseResponse,
                CountDownLatch responseClosed) {
            stallSuccessfulResponseAfterPartialBody(headersSent, releaseResponse, responseClosed, null, null);
        }

        void stallSuccessfulResponseAfterPartialBody(
                CountDownLatch headersSent,
                CountDownLatch releaseResponse,
                CountDownLatch responseClosed,
                CountDownLatch cancellationProbeRequested,
                CountDownLatch clientCancellationObserved) {
            partialBodyHeadersSent = headersSent;
            releasePartialBody = releaseResponse;
            partialBodyResponseClosed = responseClosed;
            this.cancellationProbeRequested = cancellationProbeRequested;
            this.clientCancellationObserved = clientCancellationObserved;
        }

        private void handle(HttpExchange exchange) throws IOException {
            requests.add(new RecordedRequest(
                    exchange.getRequestMethod(),
                    exchange.getRequestHeaders().getFirst("Authorization"),
                    exchange.getRequestHeaders().getFirst("Content-Type"),
                    exchange.getRequestHeaders().getFirst("Idempotency-Key"),
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
            if (partialBodyHeadersSent != null) {
                sendPartialSuccessAndStall(exchange);
                return;
            }
            CountDownLatch started = requestStarted;
            if (started != null) {
                started.countDown();
                try {
                    releaseHandler.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
            }
            Response response = responses.poll();
            if (response == null) {
                response = new Response(200, "{\"id\":\"default-id\"}");
            }
            byte[] body = response.body().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(response.status(), body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        }

        private void sendPartialSuccessAndStall(HttpExchange exchange) throws IOException {
            try {
                exchange.sendResponseHeaders(200, 0);
                OutputStream responseBody = exchange.getResponseBody();
                responseBody.write("{\"id\":\"partial".getBytes(StandardCharsets.UTF_8));
                responseBody.flush();
                partialBodyHeadersSent.countDown();
                while (!awaitRelease(releasePartialBody)) {
                    if (cancellationProbeRequested != null && cancellationProbeRequested.getCount() == 0) {
                        try {
                            responseBody.write(' ');
                            responseBody.flush();
                        } catch (IOException exception) {
                            clientCancellationObserved.countDown();
                            return;
                        }
                    }
                }
                responseBody.write("-id\"}".getBytes(StandardCharsets.UTF_8));
                responseBody.flush();
            } catch (IOException ignored) {
                // Client cancellation is expected in the bounded-body tests.
            } finally {
                partialBodyResponseClosed.countDown();
                exchange.close();
            }
        }

        private static void await(CountDownLatch latch) {
            try {
                latch.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        }

        private static boolean awaitRelease(CountDownLatch latch) {
            try {
                return latch.await(10, TimeUnit.MILLISECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return true;
            }
        }

        @Override
        public void close() {
            server.stop(0);
        }

        private record Response(int status, String body) {
        }
    }
}
