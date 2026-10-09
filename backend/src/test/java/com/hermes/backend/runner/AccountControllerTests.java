package com.hermes.backend.runner;

import com.hermes.backend.auth.AuthService;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AccountControllerTests {

    private AuthService authService;
    private AccountExportService exports;
    private AccountDeletionService deletion;
    private AccountController controller;
    private Runner runner;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        exports = mock(AccountExportService.class);
        deletion = mock(AccountDeletionService.class);
        controller = new AccountController(authService, exports, deletion);
        runner = new Runner();
        runner.setId(12L);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(authService.isAdmin(runner)).thenReturn(false);
        when(exports.tryBegin()).thenReturn(true);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> body(ResponseEntity<?> response) {
        return (Map<String, String>) response.getBody();
    }

    // --- export ----------------------------------------------------------------------------------------------

    @Test
    void exportRequiresASession() throws Exception {
        MockHttpServletResponse servlet = new MockHttpServletResponse();

        ResponseEntity<?> response = controller.exportData(null, false, servlet);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(body(response)).containsEntry("code", "UNAUTHORIZED");
        assertThat(servlet.getContentAsByteArray()).as("nothing is written for a refused export").isEmpty();
        verifyNoInteractions(exports);
    }

    @Test
    void exportIsRefusedWhileAnotherExportIsRunning() throws Exception {
        when(exports.tryBegin()).thenReturn(false);
        MockHttpServletResponse servlet = new MockHttpServletResponse();

        ResponseEntity<?> response = controller.exportData("Bearer session-token", false, servlet);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(body(response)).containsEntry("code", "EXPORT_BUSY");
        assertThat(servlet.getContentAsByteArray()).isEmpty();
        verify(exports, never()).write(any(), anyBoolean(), any());
        verify(exports, never()).end();
    }

    @Test
    void exportWritesAZipAsADownloadThatIsNeverCached() throws Exception {
        doAnswer(invocation -> {
            OutputStream out = invocation.getArgument(2);
            out.write("zip-bytes".getBytes(StandardCharsets.UTF_8));
            return null;
        }).when(exports).write(any(), anyBoolean(), any());
        MockHttpServletResponse servlet = new MockHttpServletResponse();

        ResponseEntity<?> response = controller.exportData("Bearer session-token", true, servlet);

        assertThat(response).as("the handler wrote the response itself").isNull();
        assertThat(servlet.getStatus()).isEqualTo(200);
        assertThat(servlet.getContentType()).isEqualTo("application/zip");
        assertThat(servlet.getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .startsWith("attachment; filename=\"hermes-export-").endsWith(".zip\"");
        assertThat(servlet.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
        assertThat(servlet.getContentAsString()).isEqualTo("zip-bytes");
        verify(exports).write(eq(runner), eq(true), any());
        verify(exports).end();
    }

    @Test
    void exportReleasesItsSlotEvenWhenWritingFails() throws Exception {
        doThrow(new IOException("client went away")).when(exports).write(any(), anyBoolean(), any());

        assertThatThrownBy(() -> controller.exportData("Bearer session-token", false, new MockHttpServletResponse()))
                .isInstanceOf(IOException.class);

        verify(exports).end();
    }

    // --- delete ----------------------------------------------------------------------------------------------

    @Test
    void deleteRequiresASession() {
        ResponseEntity<?> response = controller.deleteAccount(null, new AccountController.DeleteAccountBody("DELETE"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(deletion);
    }

    @Test
    void deleteRefusesAdministratorAccounts() {
        when(authService.isAdmin(runner)).thenReturn(true);

        ResponseEntity<?> response = controller.deleteAccount("Bearer session-token", new AccountController.DeleteAccountBody("DELETE"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(body(response)).containsEntry("code", "ADMIN_ACCOUNT");
        verifyNoInteractions(deletion);
    }

    @Test
    void deleteNeedsTheExactConfirmation() {
        for (AccountController.DeleteAccountBody wrong : new AccountController.DeleteAccountBody[] {
                null, new AccountController.DeleteAccountBody(null), new AccountController.DeleteAccountBody(""),
                new AccountController.DeleteAccountBody("delete"), new AccountController.DeleteAccountBody("yes"),
                new AccountController.DeleteAccountBody(" DELETE")}) {
            ResponseEntity<?> response = controller.deleteAccount("Bearer session-token", wrong);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(body(response)).containsEntry("code", "CONFIRMATION_REQUIRED");
        }
        verifyNoInteractions(deletion);
    }

    @Test
    void deleteRemovesTheSignedInRunnersAccount() {
        ResponseEntity<?> response = controller.deleteAccount("Bearer session-token", new AccountController.DeleteAccountBody("DELETE"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("deleted", true));
        verify(deletion).deleteAccount(12L);
    }
}
