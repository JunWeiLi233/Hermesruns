package com.hermes.backend;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

final class QwenProcessRunner {
    private QwenProcessRunner() {
    }

    static QwenProcessResult collect(Process process, Duration timeout, String operationName) throws IOException, InterruptedException {
        CompletableFuture<String> stdout = CompletableFuture.supplyAsync(() -> readStream(process.getInputStream()));
        CompletableFuture<String> stderr = CompletableFuture.supplyAsync(() -> readStream(process.getErrorStream()));

        boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
        if (!finished) {
            destroyProcessTree(process);
            throw new IllegalStateException(operationName + " timed out after " + timeout.toSeconds() + " seconds.");
        }

        return new QwenProcessResult(stdout.join().trim(), stderr.join().trim(), process.exitValue());
    }

    private static String readStream(java.io.InputStream stream) {
        try {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to read Qwen process stream.", ex);
        }
    }

    private static void destroyProcessTree(Process process) {
        try {
            process.toHandle()
                    .descendants()
                    .forEach(ProcessHandle::destroyForcibly);
        } catch (Exception ignored) {
            // Best effort: some platforms may not expose descendants.
        }
        process.destroyForcibly();
    }
}
