package com.hermes.backend.imports;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class StravaRetentionJobTests {

    @Test
    void doesNothingWhileRetentionIsOff() {
        StravaAccountService accounts = mock(StravaAccountService.class);
        StravaRetentionJob job = new StravaRetentionJob(accounts);
        ReflectionTestUtils.setField(job, "retentionDays", 0);

        job.purgeExpiredApiData();

        verify(accounts, never()).purgeApiDataOlderThan(any());
    }

    @Test
    void purgesRunsOlderThanTheConfiguredNumberOfDays() {
        StravaAccountService accounts = mock(StravaAccountService.class);
        StravaRetentionJob job = new StravaRetentionJob(accounts);
        ReflectionTestUtils.setField(job, "retentionDays", 7);

        job.purgeExpiredApiData();

        verify(accounts).purgeApiDataOlderThan(Duration.ofDays(7));
    }
}
