package com.hermes.backend;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ResendTransactionalMailSender implements TransactionalMailSender {

    private static final Logger LOGGER = LoggerFactory.getLogger(ResendTransactionalMailSender.class);
    private static final String NOT_CONFIGURED_MESSAGE = "Transactional mail is not configured";
    private static final String INVALID_REQUEST_MESSAGE = "Transactional mail request is invalid";
    private static final String REJECTED_MESSAGE = "Transactional mail provider rejected the request";
    private static final String TEMPORARILY_UNAVAILABLE_MESSAGE = "Transactional mail provider is temporarily unavailable";
    private static final String INVALID_RESPONSE_MESSAGE = "Transactional mail provider returned an invalid response";
    private static final int MAX_SUCCESS_RESPONSE_BYTES = 16 * 1024;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI endpoint;
    private final String apiKey;
    private final String from;
    private final String replyTo;
    private final Duration requestTimeout;

    public ResendTransactionalMailSender(
            HttpClient httpClient,
            ObjectMapper objectMapper,
            URI endpoint,
            String apiKey,
            String from,
            String replyTo) {
        this(httpClient, objectMapper, endpoint, apiKey, from, replyTo, Duration.ofSeconds(10));
    }

    ResendTransactionalMailSender(
            HttpClient httpClient,
            ObjectMapper objectMapper,
            URI endpoint,
            String apiKey,
            String from,
            String replyTo,
            Duration requestTimeout) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.from = from;
        this.replyTo = replyTo;
        this.requestTimeout = requestTimeout;
    }

    @Override
    public boolean isConfigured() {
        return isNonblank(apiKey) && isNonblank(from) && isNonblank(replyTo);
    }

    @Override
    public MailDeliveryReceipt send(TransactionalMailMessage message) {
        if (!isConfigured()) {
            throw new MailDeliveryException(NOT_CONFIGURED_MESSAGE, null, false);
        }
        if (!isValid(message)) {
            throw new MailDeliveryException(INVALID_REQUEST_MESSAGE, null, false);
        }

        String requestBody = serialize(message);
        for (int attempt = 1; attempt <= 2; attempt++) {
            ResendAttemptState attemptState = new ResendAttemptState();
            HttpRequest request = buildRequest(requestBody, message);
            CompletableFuture<HttpResponse<BoundedBodySubscriber.Body>> responseFuture = httpClient.sendAsync(
                    request, responseBodyHandler(attemptState));
            HttpResponse<BoundedBodySubscriber.Body> response;
            try {
                response = responseFuture.get(requestTimeout.toMillis(), TimeUnit.MILLISECONDS);
            } catch (InterruptedException exception) {
                responseFuture.cancel(true);
                Thread.currentThread().interrupt();
                ResendAttemptState.SuccessfulResponse successfulResponse = attemptState.cancelSuccessfulBody();
                if (successfulResponse != null) {
                    throw invalidResponseException(successfulResponse.statusCode(), attempt);
                }
                logFailure(null, true, attempt);
                throw new MailDeliveryException(TEMPORARILY_UNAVAILABLE_MESSAGE, null, true);
            } catch (TimeoutException | ExecutionException exception) {
                responseFuture.cancel(true);
                ResendAttemptState.SuccessfulResponse successfulResponse = attemptState.cancelSuccessfulBody();
                if (successfulResponse != null) {
                    throw invalidResponseException(successfulResponse.statusCode(), attempt);
                }
                logFailure(null, true, attempt);
                throw new MailDeliveryException(TEMPORARILY_UNAVAILABLE_MESSAGE, null, true);
            } catch (RuntimeException exception) {
                ResendAttemptState.SuccessfulResponse successfulResponse = attemptState.cancelSuccessfulBody();
                if (successfulResponse != null) {
                    throw invalidResponseException(successfulResponse.statusCode(), attempt);
                }
                throw exception;
            }

            int statusCode = response.statusCode();
            if (statusCode >= 200 && statusCode < 300) {
                return receiptFrom(response.body(), statusCode, attempt);
            }
            if (statusCode == 429 || (statusCode >= 500 && statusCode <= 599)) {
                logFailure(statusCode, true, attempt);
                if (attempt == 2) {
                    throw new MailDeliveryException(TEMPORARILY_UNAVAILABLE_MESSAGE, statusCode, true);
                }
                continue;
            }

            logFailure(statusCode, false, attempt);
            throw new MailDeliveryException(REJECTED_MESSAGE, statusCode, false);
        }
        throw new IllegalStateException("Unreachable mail delivery state");
    }

    private String serialize(TransactionalMailMessage message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", from);
        payload.put("to", List.of(message.to()));
        payload.put("subject", message.subject());
        payload.put("text", message.text());
        payload.put("html", message.html());
        payload.put("reply_to", replyTo);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            logFailure(null, true, 1);
            throw new MailDeliveryException(TEMPORARILY_UNAVAILABLE_MESSAGE, null, true);
        }
    }

    private HttpRequest buildRequest(String requestBody, TransactionalMailMessage message) {
        if (!isSafeHeaderToken(apiKey) || !isSafeHeaderToken(message.idempotencyKey())) {
            throw invalidRequestException();
        }
        try {
            return HttpRequest.newBuilder(endpoint)
                    .timeout(requestTimeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Idempotency-Key", message.idempotencyKey())
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();
        } catch (IllegalArgumentException exception) {
            throw invalidRequestException();
        }
    }

    private HttpResponse.BodyHandler<BoundedBodySubscriber.Body> responseBodyHandler(ResendAttemptState attemptState) {
        return responseInfo -> {
            int statusCode = responseInfo.statusCode();
            if (statusCode >= 200 && statusCode < 300) {
                BoundedBodySubscriber subscriber = new BoundedBodySubscriber(MAX_SUCCESS_RESPONSE_BYTES);
                attemptState.publishSuccessfulResponse(statusCode, subscriber);
                return subscriber;
            }
            return HttpResponse.BodySubscribers.mapping(
                    HttpResponse.BodySubscribers.discarding(), ignored -> BoundedBodySubscriber.Body.DISCARDED);
        };
    }

    private MailDeliveryReceipt receiptFrom(BoundedBodySubscriber.Body responseBody, int statusCode, int attempt) {
        if (responseBody == null || responseBody.overflow()) {
            return invalidResponse(statusCode, attempt);
        }
        try {
            JsonNode response = objectMapper.readTree(new String(responseBody.bytes(), StandardCharsets.UTF_8));
            JsonNode id = response == null ? null : response.get("id");
            if (id == null || !id.isTextual() || !isNonblank(id.textValue())) {
                return invalidResponse(statusCode, attempt);
            }
            String providerMessageId = id.textValue();
            LOGGER.info("Transactional mail sent providerMessageId={}", providerMessageId);
            return new MailDeliveryReceipt(providerMessageId);
        } catch (IOException exception) {
            return invalidResponse(statusCode, attempt);
        }
    }

    private MailDeliveryReceipt invalidResponse(int statusCode, int attempt) {
        throw invalidResponseException(statusCode, attempt);
    }

    private MailDeliveryException invalidRequestException() {
        return new MailDeliveryException(INVALID_REQUEST_MESSAGE, null, false);
    }

    private MailDeliveryException invalidResponseException(Integer statusCode, int attempt) {
        logFailure(statusCode, false, attempt);
        return new MailDeliveryException(INVALID_RESPONSE_MESSAGE, statusCode, false);
    }

    private void logFailure(Integer statusCode, boolean retryable, int attempt) {
        LOGGER.warn("Transactional mail request failed status={} retryable={} attempt={}", statusCode, retryable, attempt);
    }

    private static boolean isValid(TransactionalMailMessage message) {
        return message != null
                && isNonblank(message.to())
                && isNonblank(message.subject())
                && isNonblank(message.text())
                && isNonblank(message.html())
                && isNonblank(message.idempotencyKey());
    }

    private static boolean isNonblank(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean isSafeHeaderToken(String value) {
        if (!isNonblank(value)) {
            return false;
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character < '!' || character > '~') {
                return false;
            }
        }
        return true;
    }

}
