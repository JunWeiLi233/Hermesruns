package com.hermes.backend.admin;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.jpa.domain.Specification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminBootstrapConfigurationTests {
    private final RunnerRepository repository = mock(RunnerRepository.class);
    private final AuthService authService = mock(AuthService.class);
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(AdminBootstrapConfiguration.class)
            .withBean(RunnerRepository.class, () -> repository)
            .withBean(AuthService.class, () -> authService);

    @Test
    void missingEmailDoesNotCreateAnAccount() {
        when(authService.normalizeEmail("")).thenReturn("");
        context.run(application -> {
            application.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            verifyNoInteractions(repository);
            verify(authService, never()).storePassword(any(), any());
        });
    }

    @Test
    void missingPasswordDoesNotCreateAnAccount() {
        when(authService.normalizeEmail("admin@example.test")).thenReturn("admin@example.test");
        context.withPropertyValues("APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.test").run(application -> {
            application.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            verifyNoInteractions(repository);
            verify(authService, never()).storePassword(any(), any());
        });
    }

    @Test
    void configuredAccountUsesCanonicalPasswordStorage() {
        when(authService.normalizeEmail("ADMIN@example.test")).thenReturn("admin@example.test");
        context.withPropertyValues(
                "APP_BOOTSTRAP_ADMIN_EMAIL=ADMIN@example.test",
                "APP_BOOTSTRAP_ADMIN_PASSWORD=test-only-bootstrap-password"
        ).run(application -> {
            assertThat(application.getBeansOfType(ApplicationRunner.class)).containsOnlyKeys("bootstrapAdminRunner");
            application.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            var runner = org.mockito.ArgumentCaptor.forClass(Runner.class);
            verify(repository).save(runner.capture());
            assertThat(runner.getValue().getEmail()).isEqualTo("admin@example.test");
            assertThat(runner.getValue().getRole()).isEqualTo("ADMIN");
            assertThat(runner.getValue().getStatus()).isEqualTo("ACTIVE");
            assertThat(runner.getValue().isEmailVerified()).isTrue();
            assertThat(runner.getValue().isDeleted()).isFalse();
            verify(authService).storePassword(runner.getValue(), "test-only-bootstrap-password");
        });
    }

    @Test
    void existingAccountIsNeverPromotedReactivatedOrGivenANewPassword() {
        when(authService.normalizeEmail("admin@example.test")).thenReturn("admin@example.test");
        when(repository.existsByEmailIgnoreCase("admin@example.test")).thenReturn(true);
        context.withPropertyValues(
                "APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.test",
                "APP_BOOTSTRAP_ADMIN_PASSWORD=test-only-bootstrap-password"
        ).run(application -> {
            application.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            verify(repository).existsByEmailIgnoreCase("admin@example.test");
            verifyNoMoreInteractions(repository);
            verify(authService, never()).storePassword(any(), any());
        });
    }

    @Test
    void anotherAdministratorPreventsBootstrapOfANewEmail() {
        when(authService.normalizeEmail("admin@example.test")).thenReturn("admin@example.test");
        when(repository.count(any(Specification.class))).thenReturn(1L);
        context.withPropertyValues(
                "APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.test",
                "APP_BOOTSTRAP_ADMIN_PASSWORD=test-only-bootstrap-password"
        ).run(application -> {
            application.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            verify(repository, never()).save(any());
            verify(authService, never()).storePassword(any(), any());
        });
    }

    @Test
    void productionNeverBootstrapsAnAdministrator() {
        when(authService.normalizeEmail("admin@example.test")).thenReturn("admin@example.test");
        context.withPropertyValues(
                "hermes.environment=production",
                "APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.test",
                "APP_BOOTSTRAP_ADMIN_PASSWORD=test-only-bootstrap-password"
        ).run(application -> {
            application.getBean(ApplicationRunner.class).run(new DefaultApplicationArguments());
            verifyNoInteractions(repository);
            verify(authService, never()).storePassword(any(), any());
        });
    }

    @Test
    void restartingWithTheSameCredentialsDoesNotResetTheAccount() {
        when(authService.normalizeEmail("admin@example.test")).thenReturn("admin@example.test");
        when(repository.existsByEmailIgnoreCase("admin@example.test")).thenReturn(false, true);
        context.withPropertyValues(
                "APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.test",
                "APP_BOOTSTRAP_ADMIN_PASSWORD=test-only-bootstrap-password"
        ).run(application -> {
            ApplicationRunner bootstrap = application.getBean(ApplicationRunner.class);
            bootstrap.run(new DefaultApplicationArguments());
            bootstrap.run(new DefaultApplicationArguments());
            verify(repository, times(1)).save(any());
            verify(authService, times(1)).storePassword(any(), any());
        });
    }

    @Test
    void explicitBootstrapBeanStillOverridesTheDefault() {
        ApplicationRunner custom = args -> {};
        context.withBean("bootstrapAdminRunner", ApplicationRunner.class, () -> custom).run(application -> {
            assertThat(application.getBeansOfType(ApplicationRunner.class)).containsOnlyKeys("bootstrapAdminRunner");
            assertThat(application.getBean(ApplicationRunner.class)).isSameAs(custom);
            verifyNoInteractions(repository, authService);
        });
    }
}
