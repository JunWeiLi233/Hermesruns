package com.hermes.backend.runner;

import com.hermes.backend.auth.AuthService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The race pace zones are cut from, through the real servlet stack: session, ownership, what is refused, JSON in and out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pace-zone-race-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class PaceZoneRaceMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private RunnerPaceZoneRaceRepository rows;
    @Autowired private AccountDeletionService accountDeletion;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("pace-race-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private MockHttpServletRequestBuilder putRace(Runner as, String body) {
        return put("/api/training/pace-zones").header("Authorization", bearer(as)).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static String race(Object distance, Object seconds, Object date) {
        return "{\"distanceMeters\":" + distance + ",\"seconds\":" + seconds + ",\"date\":" + (date instanceof String ? "\"" + date + "\"" : date) + "}";
    }

    @Test
    void everyRouteNeedsASession() throws Exception {
        mockMvc.perform(get("/api/training/pace-zones")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/training/pace-zones").contentType(MediaType.APPLICATION_JSON).content(race(10000, 2700, today().toString())))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/training/pace-zones")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/training/pace-zones").header("Authorization", "Bearer nonsense")).andExpect(status().isUnauthorized());
    }

    @Test
    void aRunnerWithNoRaceGetsNullAndTheLimitsTheFormNeeds() throws Exception {
        mockMvc.perform(get("/api/training/pace-zones").header("Authorization", bearer(runner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.race").doesNotExist())
                .andExpect(jsonPath("$.limits.minDistanceMeters").value(1500.0))
                .andExpect(jsonPath("$.limits.maxDistanceMeters").value(100000.0))
                .andExpect(jsonPath("$.limits.minSeconds").value(240))
                .andExpect(jsonPath("$.limits.maxSeconds").value(86400))
                .andExpect(jsonPath("$.limits.minPaceSecondsPerKm").value(120.0))
                .andExpect(jsonPath("$.limits.maxPaceSecondsPerKm").value(1200.0))
                .andExpect(jsonPath("$.limits.maxAgeDays").value(1825));
    }

    @Test
    void aRaceIsSetReadBackAndReplacedByTheNextOne() throws Exception {
        Runner owner = runner();
        LocalDate date = today().minusDays(12);

        mockMvc.perform(putRace(owner, race(10000, 2700, date.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.race.distanceMeters").value(10000.0))
                .andExpect(jsonPath("$.race.seconds").value(2700))
                .andExpect(jsonPath("$.race.date").value(date.toString()));
        mockMvc.perform(get("/api/training/pace-zones").header("Authorization", bearer(owner)))
                .andExpect(jsonPath("$.race.seconds").value(2700));

        mockMvc.perform(putRace(owner, race(21097.5, 6000, today().minusDays(2).toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.race.distanceMeters").value(21097.5))
                .andExpect(jsonPath("$.race.seconds").value(6000));
        assertThat(rows.findByRunner(owner)).isPresent();
        assertThat(rows.findAll().stream().filter(row -> row.getRunner().getId().equals(owner.getId()))).hasSize(1);
    }

    @Test
    void aRaceIsRemovedAndRemovingNothingIsNotAnError() throws Exception {
        Runner owner = runner();
        mockMvc.perform(putRace(owner, race(5000, 1320, today().minusDays(3).toString()))).andExpect(status().isOk());

        mockMvc.perform(delete("/api/training/pace-zones").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.race").doesNotExist());
        mockMvc.perform(delete("/api/training/pace-zones").header("Authorization", bearer(owner))).andExpect(status().isOk());
        assertThat(rows.findByRunner(owner)).isEmpty();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "a distance under 1.5 km|1000|300|0",
            "a distance over 100 km|120000|40000|0",
            "a time under 4 minutes|1500|200|0",
            "a time over 24 hours|100000|90000|0",
            "a pace faster than 2:00 a km|10000|1100|0",
            "a pace slower than 20:00 a km|5000|7000|0",
    })
    void whatNoRunnerCouldHaveRunIsRefusedWithAReason(String name, String distance, String seconds, int daysAgo) throws Exception {
        Runner owner = runner();

        mockMvc.perform(putRace(owner, race(distance, seconds, today().minusDays(daysAgo).toString())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RACE"))
                .andExpect(jsonPath("$.error").isNotEmpty());
        assertThat(rows.findByRunner(owner)).isEmpty();
    }

    @Test
    void aRaceInTheFutureOrFromMoreThanFiveYearsAgoIsRefused() throws Exception {
        Runner owner = runner();

        mockMvc.perform(putRace(owner, race(10000, 2700, today().plusDays(1).toString())))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("The race cannot be in the future."));
        mockMvc.perform(putRace(owner, race(10000, 2700, today().minusDays(1826).toString())))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("A race from more than five years ago says little about your pace now."));
        mockMvc.perform(putRace(owner, race(10000, 2700, today().minusDays(1825).toString()))).andExpect(status().isOk());
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
            "{}",
            "{\"distanceMeters\":10000,\"seconds\":2700}",
            "{\"distanceMeters\":\"10000\",\"seconds\":2700,\"date\":\"2026-01-01\"}",
            "{\"distanceMeters\":10000,\"seconds\":2700.5,\"date\":\"2026-01-01\"}",
            "{\"distanceMeters\":10000,\"seconds\":null,\"date\":\"2026-01-01\"}",
            "{\"distanceMeters\":10000,\"seconds\":2700,\"date\":\"not a date\"}",
            "{\"distanceMeters\":10000,\"seconds\":2700,\"date\":20260101}",
    })
    void aBodyThatIsNotARaceIsRefusedNotCrashed(String body) throws Exception {
        mockMvc.perform(putRace(runner(), body)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_RACE"));
    }

    @Test
    void todayIsTheRunnersOwnDayNotUtc() throws Exception {
        Runner owner = runner();
        owner.setTimeZone("Pacific/Kiritimati");   // UTC+14: it is already tomorrow, UTC, there
        runners.saveAndFlush(owner);
        LocalDate theirToday = LocalDate.now(ZoneId.of("Pacific/Kiritimati"));

        mockMvc.perform(putRace(owner, race(10000, 2700, theirToday.toString()))).andExpect(status().isOk());
        mockMvc.perform(putRace(owner, race(10000, 2700, theirToday.plusDays(1).toString()))).andExpect(status().isBadRequest());
    }

    @Test
    void oneRunnersRaceIsNeverAnothers() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        mockMvc.perform(putRace(owner, race(10000, 2700, today().minusDays(5).toString()))).andExpect(status().isOk());

        mockMvc.perform(get("/api/training/pace-zones").header("Authorization", bearer(stranger)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.race").doesNotExist());
        mockMvc.perform(delete("/api/training/pace-zones").header("Authorization", bearer(stranger))).andExpect(status().isOk());
        assertThat(rows.findByRunner(owner)).isPresent();
    }

    @Test
    void deletingAnAccountDeletesItsRace() throws Exception {
        Runner doomed = runner();
        mockMvc.perform(putRace(doomed, race(10000, 2700, today().minusDays(5).toString()))).andExpect(status().isOk());
        assertThat(rows.findByRunner(doomed)).isPresent();

        accountDeletion.deleteAccount(doomed.getId());

        assertThat(rows.findAll().stream().filter(row -> row.getRunner().getId().equals(doomed.getId()))).isEmpty();
    }
}
