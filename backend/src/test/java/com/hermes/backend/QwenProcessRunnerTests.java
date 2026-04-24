package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QwenProcessRunnerTests {

    @Test
    void collectDrainsStdoutAndStderrBeforeReturning() throws Exception {
        QwenProcessResult result = QwenProcessRunner.collect(
                new FakeProcess("{\"ok\":true}", "model loaded", 0, true),
                Duration.ofSeconds(1),
                "Qwen test process"
        );

        assertThat(result.stdout()).isEqualTo("{\"ok\":true}");
        assertThat(result.stderr()).isEqualTo("model loaded");
        assertThat(result.exitCode()).isZero();
    }

    @Test
    void collectDestroysProcessWhenTimeoutExpires() {
        FakeProcess process = new FakeProcess("", "", 0, false);

        assertThatThrownBy(() -> QwenProcessRunner.collect(
                process,
                Duration.ofMillis(1),
                "Qwen test process"
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("timed out");

        assertThat(process.destroyedForcibly()).isTrue();
        assertThat(process.unboundedWaitCalled()).isFalse();
    }

    @Test
    void collectDestroysProcessDescendantsWhenTimeoutExpires() throws Exception {
        Process process = mock(Process.class);
        ProcessHandle parentHandle = mock(ProcessHandle.class);
        ProcessHandle childHandle = mock(ProcessHandle.class);
        when(process.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
        when(process.getErrorStream()).thenReturn(new ByteArrayInputStream(new byte[0]));
        when(process.waitFor(1, TimeUnit.MILLISECONDS)).thenReturn(false);
        when(process.toHandle()).thenReturn(parentHandle);
        when(parentHandle.descendants()).thenReturn(Stream.of(childHandle));

        assertThatThrownBy(() -> QwenProcessRunner.collect(
                process,
                Duration.ofMillis(1),
                "Qwen test process"
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("timed out");

        verify(childHandle).destroyForcibly();
        verify(process).destroyForcibly();
    }

    private static final class FakeProcess extends Process {
        private final InputStream inputStream;
        private final InputStream errorStream;
        private final int exitCode;
        private final boolean finishWithinTimeout;
        private boolean destroyedForcibly;
        private boolean unboundedWaitCalled;

        private FakeProcess(String stdout, String stderr, int exitCode, boolean finishWithinTimeout) {
            this.inputStream = new ByteArrayInputStream(stdout.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            this.errorStream = new ByteArrayInputStream(stderr.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            this.exitCode = exitCode;
            this.finishWithinTimeout = finishWithinTimeout;
        }

        @Override
        public OutputStream getOutputStream() {
            return OutputStream.nullOutputStream();
        }

        @Override
        public InputStream getInputStream() {
            return inputStream;
        }

        @Override
        public InputStream getErrorStream() {
            return errorStream;
        }

        @Override
        public int waitFor() {
            unboundedWaitCalled = true;
            return exitCode;
        }

        @Override
        public boolean waitFor(long timeout, TimeUnit unit) {
            return finishWithinTimeout;
        }

        @Override
        public int exitValue() {
            return exitCode;
        }

        @Override
        public void destroy() {
        }

        @Override
        public Process destroyForcibly() {
            destroyedForcibly = true;
            return this;
        }

        @Override
        public boolean isAlive() {
            return !finishWithinTimeout && !destroyedForcibly;
        }

        private boolean destroyedForcibly() {
            return destroyedForcibly;
        }

        private boolean unboundedWaitCalled() {
            return unboundedWaitCalled;
        }
    }
}
