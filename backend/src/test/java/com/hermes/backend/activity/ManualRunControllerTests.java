package com.hermes.backend.activity;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.auth.ApiRateLimiter;
import com.hermes.backend.runner.Runner;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
class ManualRunControllerTests {
    @Test void unauthenticatedRequestDoesNotWrite(){var auth=mock(AuthService.class);var service=mock(ManualRunService.class);when(auth.findByAuthorizationHeader(null)).thenReturn(Optional.empty());assertThat(new ManualRunController(auth,service,new ApiRateLimiter()).save(null,null).getStatusCode().value()).isEqualTo(401);verifyNoInteractions(service);}
    @Test void authenticatedOwnerComesFromSession(){var auth=mock(AuthService.class);var service=mock(ManualRunService.class);Runner owner=new Runner();owner.setId(42L);when(auth.findByAuthorizationHeader("Bearer fixture")).thenReturn(Optional.of(owner));var body=new ManualRunService.Request("key","time","UTC",1000,600,"Run");when(service.save(42L,body)).thenReturn(new ManualRunService.Result("7","Run",1000,600,"time","UTC",false));assertThat(new ManualRunController(auth,service,new ApiRateLimiter()).save("Bearer fixture",body).getStatusCode().value()).isEqualTo(201);verify(service).save(42L,body);}
    @Test void administratorUsesNoRunnerWriteBypass(){var auth=mock(AuthService.class);var service=mock(ManualRunService.class);Runner owner=new Runner();when(auth.findByAuthorizationHeader("Bearer fixture")).thenReturn(Optional.of(owner));when(auth.isAdmin(owner)).thenReturn(true);assertThat(new ManualRunController(auth,service,new ApiRateLimiter()).save("Bearer fixture",null).getStatusCode().value()).isEqualTo(403);verifyNoInteractions(service);}
}
