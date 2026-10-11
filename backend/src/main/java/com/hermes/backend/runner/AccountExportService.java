package com.hermes.backend.runner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityBestEffort;
import com.hermes.backend.activity.ActivityBestEffortRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityTagRepository;
import com.hermes.backend.goals.Goal;
import com.hermes.backend.goals.GoalMetrics;
import com.hermes.backend.goals.GoalRepository;
import com.hermes.backend.races.RaceEvent;
import com.hermes.backend.races.RaceEventRepository;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeRepository;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Builds the runner's data export: a ZIP with their profile, runs, shoes and races as plain files, and
 * optionally every run's GPS track as GPX. It streams, so a large history never sits in memory.
 *
 * <p>This is the runner's own copy of data Hermes holds about them. Strava's API Policy also expects an
 * app to let a user see what it collected through the API, so API-sourced runs are included and marked.</p>
 */
@Service
public class AccountExportService {

    /** One export at a time: a big export holds a database connection and the pool is small. */
    private static final Duration GATE_TIMEOUT = Duration.ofMinutes(15);

    private final ActivityRepository activities;
    private final ActivityBestEffortRepository bestEfforts;
    private final ActivityTagRepository tags;
    private final ShoeRepository shoes;
    private final RaceEventRepository races;
    private final GoalRepository goals;
    private final RunnerPaceZoneRaceRepository paceZoneRaces;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    private long runningSinceMs;

    public AccountExportService(ActivityRepository activities,
                                ActivityBestEffortRepository bestEfforts,
                                ActivityTagRepository tags,
                                ShoeRepository shoes,
                                RaceEventRepository races,
                                GoalRepository goals,
                                RunnerPaceZoneRaceRepository paceZoneRaces,
                                JdbcTemplate jdbc,
                                ObjectMapper objectMapper) {
        this.activities = activities;
        this.bestEfforts = bestEfforts;
        this.tags = tags;
        this.shoes = shoes;
        this.races = races;
        this.goals = goals;
        this.paceZoneRaces = paceZoneRaces;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    /**
     * Takes the single export slot. Returns false while another export is running. A slot held for more
     * than 15 minutes counts as abandoned (for example a client that vanished) and can be taken again.
     * The slot is per backend instance, which is enough while Hermes runs as one instance; with several
     * instances each would allow one export at a time.
     */
    public synchronized boolean tryBegin() {
        long now = System.currentTimeMillis();
        if (runningSinceMs != 0 && now - runningSinceMs < GATE_TIMEOUT.toMillis()) {
            return false;
        }
        runningSinceMs = now;
        return true;
    }

    public synchronized void end() {
        runningSinceMs = 0;
    }

    /** Writes the ZIP to {@code out}. Does not close it. */
    public void write(Runner runner, boolean includeTracks, OutputStream out) throws IOException {
        ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8);
        List<Activity> runs = activities.findByRunnerOrderByIdDesc(runner);

        entry(zip, "README.txt", readme(includeTracks));
        entry(zip, "profile.json", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(profile(runner)));
        entry(zip, "runs.csv", runsCsv(runs, tagsByRun(runner.getId())));
        entry(zip, "best-efforts.csv", bestEffortsCsv(bestEfforts.findAllForRunner(runner.getId())));
        entry(zip, "shoes.csv", shoesCsv(shoes.findByRunnerOrderByCreatedAtDesc(runner)));
        entry(zip, "races.csv", racesCsv(races.findByRunnerOrderByEventDateAsc(runner)));
        entry(zip, "goals.csv", goalsCsv(goals.findByRunnerIdOrderByIdAsc(runner.getId())));
        entry(zip, "pace-zone-race.csv", paceZoneRaceCsv(paceZoneRaces.findByRunner(runner).orElse(null)));

        if (includeTracks) {
            for (Activity run : runs) {
                writeTrack(zip, run);
            }
        }
        zip.finish();
        zip.flush();
    }

    // --- contents ---------------------------------------------------------------------------------------------

    private Map<String, Object> profile(Runner runner) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("exportedAt", java.time.Instant.now().toString());
        profile.put("email", runner.getEmail());
        profile.put("displayName", runner.getDisplayName());
        profile.put("createdAt", runner.getCreatedAt() == null ? null : runner.getCreatedAt().toString());
        profile.put("maxHeartRateBpm", runner.getMaxHeartRateBpm());
        profile.put("restingHeartRateBpm", runner.getRestingHeartRateBpm());
        profile.put("timeZone", runner.getTimeZone());
        profile.put("subscriptionTier", runner.getSubscriptionTier());
        profile.put("stravaConnected", runner.getStravaAthleteId() != null);
        return profile;
    }

    private static String readme(boolean includeTracks) {
        return """
                Hermes data export
                ==================

                profile.json  Your account details (no passwords or tokens).
                runs.csv      Every run Hermes holds for you.
                best-efforts.csv  The fastest stretch of each standard distance in each run, with the times
                              you typed in and the efforts you hid.
                shoes.csv     Your shoes.
                races.csv     Your saved races.
                goals.csv     Your goals: the period and the metric, the target in the unit named in the file
                              (km, s for seconds of moving time, runs, m), and when you set it.
                pace-zone-race.csv  The race you cut your pace zones from, if you entered one: distance in metres,
                              time in seconds, the date of the race.
                """ + (includeTracks
                ? "tracks/      One GPX file per run that has a GPS track.\n"
                : "tracks/      Not included. Ask for them with ?tracks=true.\n") + """

                Notes
                - runs.csv has a source column. STRAVA_API means the run was fetched from Strava.
                - start_time_basis says how to read start_time: "local" is the clock time where you ran
                  (runs fetched from Strava); "utc" is UTC (runs imported from files or devices).
                - run_type is RACE, LONG_RUN or WORKOUT when you set one, and empty otherwise. tags holds the
                  words you put on the run, in the order you added them, separated by "; ".
                - GPX files carry timestamps only for runs whose start time is UTC.
                - Not included yet: coach plans, wellness series (sleep, HRV, stress), muscle-training logs.
                """;
    }

    /** Each run's tags, in the order the runner added them. */
    private Map<Long, List<String>> tagsByRun(Long runnerId) {
        Map<Long, List<String>> byRun = new HashMap<>();
        for (Object[] row : tags.findAllLabels(runnerId)) {
            byRun.computeIfAbsent((Long) row[0], id -> new ArrayList<>()).add((String) row[1]);
        }
        return byRun;
    }

    private static String runsCsv(List<Activity> runs, Map<Long, List<String>> tagsByRun) {
        StringBuilder csv = new StringBuilder(
                "id,name,start_time,start_time_basis,source,distance_m,duration_s,moving_time_s,"
                        + "average_heart_rate,max_heart_rate,elevation_gain_m,calories,average_cadence,shoe,created_at,run_type,tags\n");
        for (Activity run : runs) {
            csv.append(row(
                    String.valueOf(run.getId()),
                    text(run.getName()),
                    value(run.getStartTime()),
                    run.isStravaApiSourced() ? "local" : "utc",
                    run.isStravaApiSourced() ? "STRAVA_API" : String.valueOf(run.getProvider()),
                    value(run.getDistanceMeters() != null ? run.getDistanceMeters() : run.getDistanceKm() * 1000.0),
                    value(run.getDurationSeconds()),
                    value(run.getMovingTimeSeconds()),
                    value(run.getAverageHeartRate()),
                    value(run.getMaxHeartRate()),
                    value(run.getTotalElevationGain()),
                    value(run.getCalories()),
                    value(run.getAverageCadence()),
                    text(run.getShoeName()),
                    value(run.getCreatedAt()),
                    text(run.getRunType()),
                    text(String.join("; ", tagsByRun.getOrDefault(run.getId(), List.of())))
            ));
        }
        return csv.toString();
    }

    private static String bestEffortsCsv(List<ActivityBestEffort> efforts) {
        StringBuilder csv = new StringBuilder(
                "run_id,distance,distance_m,measured_s,typed_s,counted_s,estimated,hidden,date\n");
        for (ActivityBestEffort effort : efforts) {
            csv.append(row(
                    String.valueOf(effort.getActivity().getId()),
                    effort.getDistanceKey(),
                    value(effort.getDistanceMeters()),
                    value(effort.getElapsedSeconds()),
                    value(effort.getEditedElapsedSeconds()),
                    value(effort.getEffectiveSeconds()),
                    String.valueOf(effort.isEstimated()),
                    String.valueOf(effort.isHidden()),
                    value(effort.getLocalDate())
            ));
        }
        return csv.toString();
    }

    private static String shoesCsv(List<Shoe> shoes) {
        StringBuilder csv = new StringBuilder(
                "brand,model,nickname,type,surface_type,initial_distance_km,max_distance_km,retired,retired_date,created_at\n");
        for (Shoe shoe : shoes) {
            csv.append(row(
                    text(shoe.getBrand()), text(shoe.getModel()), text(shoe.getNickname()),
                    text(shoe.getType()), text(shoe.getSurfaceType()),
                    value(shoe.getInitialDistanceKm()), value(shoe.getMaxDistanceKm()),
                    String.valueOf(shoe.isRetired()), value(shoe.getRetiredDate()), value(shoe.getCreatedAt())
            ));
        }
        return csv.toString();
    }

    private static String racesCsv(List<RaceEvent> races) {
        StringBuilder csv = new StringBuilder("name,organization,location,event_date,distance_km,status,goal_time_s,notes\n");
        for (RaceEvent race : races) {
            csv.append(row(
                    text(race.getName()), text(race.getOrganization()), text(race.getLocation()),
                    value(race.getEventDate()), value(race.getDistanceKm()), value(race.getRegistrationStatus()),
                    value(race.getGoalTimeSeconds()), text(race.getNotes())
            ));
        }
        return csv.toString();
    }

    private static String goalsCsv(List<Goal> goals) {
        StringBuilder csv = new StringBuilder("period,metric,target,unit,created_at,updated_at\n");
        for (Goal goal : goals) {
            csv.append(row(
                    goal.getPeriod(), goal.getMetric(), value(goal.getTarget()), GoalMetrics.unit(goal.getMetric()),
                    value(goal.getCreatedAt()), value(goal.getUpdatedAt())
            ));
        }
        return csv.toString();
    }

    private static String paceZoneRaceCsv(RunnerPaceZoneRace race) {
        StringBuilder csv = new StringBuilder("distance_m,time_s,race_date,updated_at\n");
        if (race != null) {
            csv.append(row(value(race.getDistanceMeters()), value(race.getTimeSeconds()), value(race.getRaceDate()), value(race.getUpdatedAt())));
        }
        return csv.toString();
    }

    private void writeTrack(ZipOutputStream zip, Activity run) throws IOException {
        Long points = jdbc.queryForObject("select count(*) from activity_points where activity_id = ?", Long.class, run.getId());
        if (points == null || points == 0) {
            return;
        }
        zip.putNextEntry(new ZipEntry("tracks/" + run.getId() + ".gpx"));
        Writer writer = new OutputStreamWriter(zip, StandardCharsets.UTF_8);
        writer.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<gpx version=\"1.1\" creator=\"Hermes\" xmlns=\"http://www.topografix.com/GPX/1/1\" "
                + "xmlns:gpxtpx=\"http://www.garmin.com/xmlschemas/TrackPointExtension/v1\">\n"
                + "<trk><name>" + xml(run.getName() == null ? "Run " + run.getId() : run.getName()) + "</name><trkseg>\n");
        // Runs fetched from Strava store the runner's local clock time, which cannot be written as a UTC
        // timestamp without lying, so those tracks carry no time.
        boolean writeTime = !run.isStravaApiSourced() && run.getStartTime() != null;
        jdbc.query(
                "select latitude, longitude, elevation_meters, elapsed_seconds, heart_rate, cadence "
                        + "from activity_points where activity_id = ? order by sequence_index",
                rs -> {
                    try {
                        StringBuilder point = new StringBuilder("<trkpt lat=\"").append(rs.getDouble(1))
                                .append("\" lon=\"").append(rs.getDouble(2)).append("\">");
                        double elevation = rs.getDouble(3);
                        if (!rs.wasNull()) {
                            point.append("<ele>").append(elevation).append("</ele>");
                        }
                        int elapsed = rs.getInt(4);
                        if (!rs.wasNull() && writeTime) {
                            point.append("<time>").append(run.getStartTime().plusSeconds(elapsed).atOffset(ZoneOffset.UTC)).append("</time>");
                        }
                        int heartRate = rs.getInt(5);
                        boolean hasHeartRate = !rs.wasNull();
                        int cadence = rs.getInt(6);
                        boolean hasCadence = !rs.wasNull();
                        if (hasHeartRate || hasCadence) {
                            point.append("<extensions><gpxtpx:TrackPointExtension>");
                            if (hasHeartRate) {
                                point.append("<gpxtpx:hr>").append(heartRate).append("</gpxtpx:hr>");
                            }
                            if (hasCadence) {
                                point.append("<gpxtpx:cad>").append(cadence).append("</gpxtpx:cad>");
                            }
                            point.append("</gpxtpx:TrackPointExtension></extensions>");
                        }
                        point.append("</trkpt>\n");
                        writer.write(point.toString());
                    } catch (IOException e) {
                        throw new java.io.UncheckedIOException(e);
                    }
                },
                run.getId());
        writer.write("</trkseg></trk>\n</gpx>\n");
        writer.flush();
        zip.closeEntry();
    }

    // --- formatting -------------------------------------------------------------------------------------------

    private static void entry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String row(String... fields) {
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) {
                line.append(',');
            }
            line.append(quote(fields[i]));
        }
        return line.append('\n').toString();
    }

    private static String value(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * Free text from the runner or from a provider (a run title). A cell that starts with a formula
     * character would be run as a formula when the file is opened in a spreadsheet, so it is made inert.
     */
    static String text(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            return "'" + value;
        }
        return value;
    }

    private static String quote(String field) {
        if (field.indexOf(',') >= 0 || field.indexOf('"') >= 0 || field.indexOf('\n') >= 0 || field.indexOf('\r') >= 0) {
            return "\"" + field.replace("\"", "\"\"") + "\"";
        }
        return field;
    }

    private static String xml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    static String filename(LocalDate date) {
        return "hermes-export-" + date.toString().toLowerCase(Locale.ROOT) + ".zip";
    }
}
