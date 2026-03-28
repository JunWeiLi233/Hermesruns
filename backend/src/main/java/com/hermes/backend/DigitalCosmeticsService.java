package com.hermes.backend;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DigitalCosmeticsService {
    private static final double MONTHLY_CLASSIFIED_KM = 240.0;
    private static final double MONTHLY_RESTRICTED_KM = 120.0;
    private static final double SHOE_RETIRE_KM = 800.0;
    private static final int MIN_HUMAN_CADENCE = 140;
    private static final int MAX_HUMAN_CADENCE = 200;

    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;
    private final ShoeRepository shoeRepository;
    private final DigitalCosmeticDropRepository dropRepository;
    private final RestTemplate restTemplate;

    public DigitalCosmeticsService(RunnerRepository runnerRepository,
                                   ActivityRepository activityRepository,
                                   ActivityPointRepository activityPointRepository,
                                   CoachScheduledWorkoutRepository coachScheduledWorkoutRepository,
                                   ShoeRepository shoeRepository,
                                   DigitalCosmeticDropRepository dropRepository,
                                   RestTemplate restTemplate) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.coachScheduledWorkoutRepository = coachScheduledWorkoutRepository;
        this.shoeRepository = shoeRepository;
        this.dropRepository = dropRepository;
        this.restTemplate = restTemplate;
    }

    @Transactional
    public void handleActivityIngested(Long runnerId, Long activityId) {
        Optional<Runner> runnerOpt = runnerRepository.findById(runnerId);
        Optional<Activity> activityOpt = activityRepository.findById(activityId);
        if (runnerOpt.isEmpty() || activityOpt.isEmpty()) return;

        Runner runner = runnerOpt.get();
        Activity activity = activityOpt.get();
        if (activity.getActivityType() != ActivityType.RUN) return;
        if (activity.getRunner() == null || !Objects.equals(activity.getRunner().getId(), runnerId)) return;

        WearContext wearContext = resolveWearContext(runner, activity);

        // Standard drop: single-run proof of work (>=10km)
        if (distanceKm(activity) >= 10.0 && recentDropCount(runner, DigitalCosmeticTier.MIL_SPEC, 7) == 0) {
            mintDrop(runner, activity, null, DigitalCosmeticTier.MIL_SPEC, wearContext, false, "10K Proof of Work");
        }

        double km28 = volumeKmLastDays(runner, 28);
        if (km28 >= MONTHLY_RESTRICTED_KM && recentDropCount(runner, DigitalCosmeticTier.RESTRICTED, 14) == 0) {
            mintDrop(runner, activity, null, DigitalCosmeticTier.RESTRICTED, wearContext, false, "Consistency Engine");
        }

        // Classified: high monthly volume
        if (km28 >= MONTHLY_CLASSIFIED_KM) {
            boolean spoofed = failsAntiSpoof(activity);
            if (recentDropCount(runner, DigitalCosmeticTier.CLASSIFIED, 28) == 0) {
                mintDrop(runner, activity, null, DigitalCosmeticTier.CLASSIFIED, wearContext, spoofed, "240K Monthly Grinder");
            }
        }

        // Covert ultra-rare: 16-week coach adherence >= 90%
        double adherence = coachAdherenceLast16Weeks(runner);
        if (adherence >= 0.90) {
            boolean spoofed = failsAntiSpoof(activity);
            if (dropRepository.countByRunnerAndTierAndVoidedByAntiSpoofFalse(runner, DigitalCosmeticTier.COVERT) == 0) {
                mintDrop(runner, activity, null, DigitalCosmeticTier.COVERT, wearContext, spoofed,
                        "16-Week Coach Discipline");
            }
        }

        // Equipment prestige + automatic retirement
        maybeRetireShoeAndAwardHallOfFame(activity, wearContext);
    }

    @Transactional(readOnly = true)
    public List<DigitalCosmeticClientPayload> listInventory(Runner runner) {
        List<DigitalCosmeticDrop> rows = dropRepository.findByRunnerAndVoidedByAntiSpoofFalseOrderByCreatedAtDesc(runner);
        List<DigitalCosmeticClientPayload> out = new ArrayList<>(rows.size());
        for (DigitalCosmeticDrop row : rows) {
            out.add(new DigitalCosmeticClientPayload(
                    row.getId(),
                    row.getTier().name(),
                    row.getTitle(),
                    row.getWearFloat(),
                    row.getWearLabel(),
                    row.getRewardPayloadJson(),
                    parsePayload(row.getRewardPayloadJson()),
                    row.getCreatedAt()
            ));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public ActiveThemePayload getActiveTheme(Runner runner) {
        List<DigitalCosmeticDrop> rows = dropRepository.findByRunnerAndVoidedByAntiSpoofFalseOrderByCreatedAtDesc(runner);
        if (rows.isEmpty()) return null;

        DigitalCosmeticDrop best = null;
        for (DigitalCosmeticDrop row : rows) {
            if (best == null || tierRank(row.getTier()) > tierRank(best.getTier())) {
                best = row;
                continue;
            }
            if (tierRank(row.getTier()) == tierRank(best.getTier())
                    && row.getCreatedAt() != null
                    && best.getCreatedAt() != null
                    && row.getCreatedAt().isAfter(best.getCreatedAt())) {
                best = row;
            }
        }
        if (best == null) return null;
        return new ActiveThemePayload(
                best.getId(),
                best.getTier().name(),
                best.getWearLabel(),
                best.getWearFloat(),
                parsePayload(best.getRewardPayloadJson()),
                best.getCreatedAt()
        );
    }

    private void maybeRetireShoeAndAwardHallOfFame(Activity activity, WearContext wearContext) {
        Shoe shoe = activity.getShoe();
        if (shoe == null || shoe.isRetired()) return;
        double activityKm = activityRepository.sumDistanceKmByShoeId(shoe.getId());
        double initialKm = shoe.getInitialDistanceKm() != null ? shoe.getInitialDistanceKm() : 0.0;
        double totalKm = activityKm + initialKm;
        if (totalKm < SHOE_RETIRE_KM) return;

        shoe.setRetired(true);
        shoeRepository.save(shoe);

        Double avgPaceSecPerKm = activityRepository.findAveragePaceSecondsPerKmByShoe(shoe, ActivityType.RUN);
        String banner = String.format(Locale.ROOT,
                "{\"type\":\"hall_of_fame\",\"shoe\":\"%s %s\",\"mileageKm\":%.1f,\"avgPaceSecPerKm\":%s}",
                nullable(shoe.getBrand()), nullable(shoe.getModel()), totalKm,
                avgPaceSecPerKm == null ? "null" : String.format(Locale.ROOT, "%.1f", avgPaceSecPerKm));
        mintDrop(
                shoe.getRunner(),
                activity,
                shoe,
                DigitalCosmeticTier.HALL_OF_FAME,
                wearContext,
                false,
                "Retired Shoe Hall of Fame",
                banner
        );
    }

    private long recentDropCount(Runner runner, DigitalCosmeticTier tier, int days) {
        return dropRepository.countByRunnerAndTierAndVoidedByAntiSpoofFalseAndCreatedAtAfter(
                runner, tier, LocalDateTime.now().minusDays(days)
        );
    }

    private double volumeKmLastDays(Runner runner, int days) {
        LocalDateTime now = LocalDateTime.now();
        List<Activity> runs = activityRepository.findRunsBetween(runner, ActivityType.RUN, now.minusDays(days), now);
        return runs.stream().mapToDouble(this::distanceKm).sum();
    }

    private double coachAdherenceLast16Weeks(Runner runner) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusWeeks(16);
        List<CoachScheduledWorkout> schedule = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetween(runner, start, end);
        if (schedule.isEmpty()) return 0.0;

        Map<LocalDate, CoachScheduledWorkout> byDate = new HashMap<>();
        for (CoachScheduledWorkout w : schedule) byDate.put(w.getScheduledDate(), w);

        List<Activity> runs = activityRepository.findRunsBetween(
                runner, ActivityType.RUN, start.atStartOfDay(), end.plusDays(1).atStartOfDay()
        );
        Map<LocalDate, Activity> runByDate = new HashMap<>();
        for (Activity a : runs) {
            runByDate.put(resolveDate(a), a);
        }

        int scoredDays = 0;
        int adhered = 0;
        for (Map.Entry<LocalDate, CoachScheduledWorkout> entry : byDate.entrySet()) {
            CoachScheduledWorkout w = entry.getValue();
            if (w.getWorkoutType() == CoachWorkoutType.REST) continue;
            Activity done = runByDate.get(entry.getKey());
            scoredDays++;
            if (done == null) continue;
            double planned = w.getPlannedDistanceKm() != null ? w.getPlannedDistanceKm() : 0.0;
            if (planned <= 0.0) {
                adhered++;
                continue;
            }
            double actual = distanceKm(done);
            double ratio = actual / planned;
            if (ratio >= 0.80 && ratio <= 1.30) {
                adhered++;
            }
        }
        if (scoredDays == 0) return 0.0;
        return adhered / (double) scoredDays;
    }

    private boolean failsAntiSpoof(Activity activity) {
        double cadence = activity.getAverageCadence() != null ? activity.getAverageCadence() : 0.0;
        if (cadence < MIN_HUMAN_CADENCE || cadence > MAX_HUMAN_CADENCE) {
            return true;
        }
        double km = distanceKm(activity);
        int sec = activity.getMovingTimeSeconds() > 0 ? activity.getMovingTimeSeconds() : 0;
        if (km <= 0 || sec <= 0) return true;
        double paceSecPerKm = sec / km;
        double hr = activity.getAverageHeartRate() != null ? activity.getAverageHeartRate() : 0.0;

        // Very fast with very low HR is suspicious.
        return paceSecPerKm < 190.0 && hr > 0 && hr < 110.0;
    }

    private WearContext resolveWearContext(Runner runner, Activity activity) {
        double driftProxy = 0.0;
        if (activity.getAverageHeartRate() != null && activity.getMaxHeartRate() != null && activity.getAverageHeartRate() > 0) {
            driftProxy = Math.max(0.0, (activity.getMaxHeartRate() - activity.getAverageHeartRate()) / activity.getAverageHeartRate());
        }

        WeatherSeverity weather = weatherForActivity(runner, activity);
        double weatherSeverity = weather.severityScore;
        double wearFloat = clamp01(0.55 * weatherSeverity + 0.45 * clamp01(driftProxy));
        String wearLabel = wearLabel(wearFloat);
        return new WearContext(round3(wearFloat), wearLabel, weather);
    }

    private WeatherSeverity weatherForActivity(Runner runner, Activity activity) {
        List<Object[]> latestLatLng = activityPointRepository.findLatestLatLngByRunnerAndType(
                runner.getId(), ActivityType.RUN.name()
        );
        if (latestLatLng.isEmpty()) {
            return new WeatherSeverity(0.35, null, null, null);
        }
        double lat = ((Number) latestLatLng.get(0)[0]).doubleValue();
        double lon = ((Number) latestLatLng.get(0)[1]).doubleValue();

        LocalDate date = resolveDate(activity);
        URI uri = UriComponentsBuilder.fromUriString("https://archive-api.open-meteo.com/v1/archive")
                .queryParam("latitude", lat)
                .queryParam("longitude", lon)
                .queryParam("start_date", date)
                .queryParam("end_date", date)
                .queryParam("daily", "dew_point_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum")
                .queryParam("timezone", "auto")
                .build()
                .toUri();

        try {
            RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(request, new ParameterizedTypeReference<>() {});
            Map<String, Object> body = response.getBody();
            if (body == null || !(body.get("daily") instanceof Map<?, ?> daily)) {
                return new WeatherSeverity(0.35, null, null, null);
            }
            Double dew = firstNumber(daily.get("dew_point_2m_mean"));
            Double tMin = firstNumber(daily.get("temperature_2m_min"));
            Double rain = firstNumber(daily.get("precipitation_sum"));
            double sev = 0.0;
            if (dew != null) sev += clamp01((dew - 12.0) / 16.0);
            if (tMin != null && tMin < 5.0) sev += clamp01((5.0 - tMin) / 10.0);
            if (rain != null) sev += clamp01(rain / 15.0);
            sev = clamp01(sev / 2.2);
            return new WeatherSeverity(sev, dew, tMin, rain);
        } catch (Exception ignored) {
            return new WeatherSeverity(0.35, null, null, null);
        }
    }

    private void mintDrop(Runner runner,
                          Activity activity,
                          Shoe shoe,
                          DigitalCosmeticTier tier,
                          WearContext wearContext,
                          boolean voided,
                          String title) {
        mintDrop(runner, activity, shoe, tier, wearContext, voided, title, buildPayload(tier, wearContext));
    }

    private void mintDrop(Runner runner,
                          Activity activity,
                          Shoe shoe,
                          DigitalCosmeticTier tier,
                          WearContext wearContext,
                          boolean voided,
                          String title,
                          String payloadJson) {
        DigitalCosmeticDrop row = new DigitalCosmeticDrop();
        row.setRunner(runner);
        row.setActivity(activity);
        row.setShoe(shoe);
        row.setTier(tier);
        row.setWearFloat(wearContext.wearFloat);
        row.setWearLabel(wearContext.wearLabel);
        row.setVoidedByAntiSpoof(voided);
        row.setTitle(title);
        row.setRewardPayloadJson(payloadJson);
        dropRepository.save(row);
    }

    private String buildPayload(DigitalCosmeticTier tier, WearContext wear) {
        String cdn = Optional.ofNullable(System.getenv("APP_CDN_BASE_URL"))
                .filter(s -> !s.isBlank())
                .orElse("https://cdn.hermes.app/cosmetics");
        String texture = switch (tier) {
            case MIL_SPEC -> "mil_spec";
            case RESTRICTED -> "restricted";
            case CLASSIFIED -> "classified";
            case COVERT -> "covert";
            case HALL_OF_FAME -> "hall_of_fame";
        };
        String[] colors = colorsFromWear(tier, wear.wearFloat);
        return String.format(Locale.ROOT,
                "{\"theme\":{\"primary\":\"%s\",\"accent\":\"%s\"},\"animationUrl\":\"%s/%s/anim.json\",\"textureUrl\":\"%s/%s/%s.png\",\"wear\":%.3f}",
                colors[0], colors[1], cdn, texture, cdn, texture, wear.wearLabel.toLowerCase(Locale.ROOT).replace(' ', '_'), wear.wearFloat
        );
    }

    private String[] colorsFromWear(DigitalCosmeticTier tier, double wear) {
        String primaryBase = switch (tier) {
            case MIL_SPEC -> "#4f46e5";
            case RESTRICTED -> "#7c3aed";
            case CLASSIFIED -> "#db2777";
            case COVERT -> "#b91c1c";
            case HALL_OF_FAME -> "#a16207";
        };
        String accentBase = wear > 0.7 ? "#4b5563" : (wear > 0.35 ? "#64748b" : "#e2e8f0");
        return new String[]{primaryBase, accentBase};
    }

    private static String wearLabel(double wearFloat) {
        if (wearFloat <= 0.07) return "Factory New";
        if (wearFloat <= 0.20) return "Minimal Wear";
        if (wearFloat <= 0.45) return "Field-Tested";
        if (wearFloat <= 0.75) return "Well-Worn";
        return "Battle-Scarred";
    }

    private static Double firstNumber(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) return null;
        Object first = list.get(0);
        if (first instanceof Number n) return n.doubleValue();
        return null;
    }

    private LocalDate resolveDate(Activity a) {
        if (a.getStartTime() != null) return a.getStartTime().toLocalDate();
        if (a.getStartDate() != null && a.getStartDate().length() >= 10) {
            try {
                return LocalDate.parse(a.getStartDate().substring(0, 10));
            } catch (Exception ignored) {
            }
        }
        if (a.getCreatedAt() != null) return a.getCreatedAt().toLocalDate();
        return LocalDate.now();
    }

    private double distanceKm(Activity a) {
        if (a.getDistanceKm() > 0) return a.getDistanceKm();
        if (a.getDistanceMeters() != null && a.getDistanceMeters() > 0) return a.getDistanceMeters() / 1000.0;
        return 0.0;
    }

    private static String nullable(String value) {
        return value == null ? "" : value.replace("\"", "");
    }

    private static double clamp01(double v) {
        return Math.max(0.0, Math.min(1.0, v));
    }

    private static double round3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private Map<String, Object> parsePayload(String payload) {
        if (payload == null || payload.isBlank()) return Map.of();
        String primary = extractString(payload, "\"primary\"\\s*:\\s*\"([^\"]+)\"");
        String accent = extractString(payload, "\"accent\"\\s*:\\s*\"([^\"]+)\"");
        String animationUrl = extractString(payload, "\"animationUrl\"\\s*:\\s*\"([^\"]+)\"");
        String textureUrl = extractString(payload, "\"textureUrl\"\\s*:\\s*\"([^\"]+)\"");
        Double wear = extractNumber(payload, "\"wear\"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)");

        Map<String, Object> theme = new LinkedHashMap<>();
        if (primary != null) theme.put("primary", primary);
        if (accent != null) theme.put("accent", accent);

        Map<String, Object> assets = new LinkedHashMap<>();
        if (animationUrl != null) assets.put("animationUrl", animationUrl);
        if (textureUrl != null) assets.put("textureUrl", textureUrl);

        Map<String, Object> out = new LinkedHashMap<>();
        if (!theme.isEmpty()) out.put("theme", theme);
        if (!assets.isEmpty()) out.put("assets", assets);
        if (wear != null) out.put("wear", wear);
        out.put("rawJson", payload);
        return out;
    }

    private static String extractString(String text, String regex) {
        Matcher matcher = Pattern.compile(regex).matcher(text);
        if (!matcher.find()) return null;
        return matcher.group(1);
    }

    private static Double extractNumber(String text, String regex) {
        Matcher matcher = Pattern.compile(regex).matcher(text);
        if (!matcher.find()) return null;
        try {
            return Double.parseDouble(matcher.group(1));
        } catch (Exception ignored) {
            return null;
        }
    }

    private static int tierRank(DigitalCosmeticTier tier) {
        return switch (tier) {
            case MIL_SPEC -> 1;
            case RESTRICTED -> 2;
            case CLASSIFIED -> 3;
            case COVERT -> 4;
            case HALL_OF_FAME -> 5;
        };
    }

    private record WeatherSeverity(double severityScore, Double dewPointC, Double tempMinC, Double precipitationMm) {}
    private record WearContext(double wearFloat, String wearLabel, WeatherSeverity weather) {}

    public record DigitalCosmeticClientPayload(
            Long id,
            String tier,
            String title,
            Double wearFloat,
            String wearLabel,
            String rewardPayloadJson,
            Map<String, Object> rewardPayload,
            LocalDateTime createdAt
    ) {}

    public record ActiveThemePayload(
            Long sourceDropId,
            String tier,
            String wearLabel,
            Double wearFloat,
            Map<String, Object> rewardPayload,
            LocalDateTime createdAt
    ) {}
}
