package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OAuthControllerTests {

    @Test
    void fetchAndSaveStravaActivitiesRetriesOnceWithRefreshedStoredToken() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);

        OAuthController controller = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );

        Runner staleRunner = new Runner();
        staleRunner.setId(7L);
        staleRunner.setStravaAccessToken("encrypted-old-access");
        staleRunner.setStravaRefreshToken("encrypted-refresh");
        staleRunner.setStravaTokenExpiresAt((System.currentTimeMillis() / 1000) + 3600);

        Runner freshRunner = new Runner();
        freshRunner.setId(7L);
        freshRunner.setStravaAccessToken("encrypted-new-access");
        freshRunner.setStravaRefreshToken("encrypted-refresh");
        freshRunner.setStravaTokenExpiresAt((System.currentTimeMillis() / 1000) + 3600);

        Activity existingActivity = new Activity();
        existingActivity.setId(88L);
        existingActivity.setActivityType(ActivityType.RUN);
        existingActivity.setRunner(freshRunner);

        when(runnerRepository.findById(7L)).thenReturn(Optional.of(staleRunner), Optional.of(freshRunner));
        when(secretEncryptionService.decrypt("encrypted-new-access")).thenReturn("fresh-access-token");
        when(secretEncryptionService.decrypt("encrypted-refresh")).thenReturn("refresh-token");
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(freshRunner, ImportProvider.STRAVA, "STRAVA_12345"))
                .thenReturn(Optional.of(existingActivity));
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(true);

        HttpClientErrorException unauthorized = HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED,
                "Unauthorized",
                HttpHeaders.EMPTY,
                new byte[0],
                null
        );
        ResponseEntity<List<Map<String, Object>>> activityPage = ResponseEntity.ok(List.of(Map.of(
                "id", "12345",
                "sport_type", "Run",
                "type", "Run",
                "name", "Park Loop",
                "distance", 6400.0,
                "moving_time", 1700,
                "start_date_local", "2026-04-05T07:15:00Z"
        )));

        when(restTemplate.exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenThrow(unauthorized).thenReturn(activityPage);

        when(restTemplate.exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=2"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(List.of()));

        controller.fetchAndSaveStravaActivities("stale-access-token", 7L, false);

        verify(restTemplate, times(2)).exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        );
        verify(runnerRepository, times(2)).findById(7L);
        verify(activityRepository).save(any(Activity.class));
    }
}
