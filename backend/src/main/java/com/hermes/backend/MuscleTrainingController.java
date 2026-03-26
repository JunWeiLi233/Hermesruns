package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/training/muscle")
public class MuscleTrainingController {
    private final AuthService authService;
    private final ActivityRepository activityRepository;

    public MuscleTrainingController(AuthService authService, ActivityRepository activityRepository) {
        this.authService = authService;
        this.activityRepository = activityRepository;
    }

    @GetMapping("/recommendation")
    public ResponseEntity<?> getRecommendation(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        }

        Runner runner = runnerOpt.get();
        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);

        MuscleTrainingRecommendation rec = MuscleTrainingRecommendation.fromRuns(runs);
        return ResponseEntity.ok(rec.toResponse());
    }

    static final class MuscleTrainingRecommendation {
        private final double weeklyKm;
        private final int sessionsPerWeek;
        private final String level;
        private final String focus;
        private final String recoveryHint;
        private final List<String> rationale;
        private final List<Map<String, Object>> sessions;

        private MuscleTrainingRecommendation(
                double weeklyKm,
                int sessionsPerWeek,
                String level,
                String focus,
                String recoveryHint,
                List<String> rationale,
                List<Map<String, Object>> sessions
        ) {
            this.weeklyKm = weeklyKm;
            this.sessionsPerWeek = sessionsPerWeek;
            this.level = level;
            this.focus = focus;
            this.recoveryHint = recoveryHint;
            this.rationale = rationale;
            this.sessions = sessions;
        }

        static MuscleTrainingRecommendation fromRuns(List<Activity> runs) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime cutoff28 = now.minusDays(28);

            List<Activity> recent = new ArrayList<>();
            for (Activity a : runs) {
                LocalDateTime t = a.getStartTime();
                if (t == null) {
                    continue;
                }
                if (t.isBefore(cutoff28)) {
                    break;
                }
                recent.add(a);
            }

            double km28 = recent.stream().mapToDouble(MuscleTrainingRecommendation::resolveDistanceKm).sum();
            double weeklyKm = km28 / 4.0;

            RunIntensitySummary intensity = summarizeIntensity(recent);

            int sessionsPerWeek;
            String level;
            if (recent.isEmpty()) {
                weeklyKm = 0.0;
                sessionsPerWeek = 1;
                level = "new";
            } else if (weeklyKm < 15) {
                sessionsPerWeek = 1;
                level = "restart";
            } else if (weeklyKm < 35) {
                sessionsPerWeek = 2;
                level = "base";
            } else {
                sessionsPerWeek = 3;
                level = "build";
            }

            // If running load is spiking, keep strength conservative.
            if (intensity.acwr != null && intensity.acwr > 1.2) {
                sessionsPerWeek = Math.min(sessionsPerWeek, 1);
                level = "deload";
            }

            // Evidence-based emphasis for runners: hips + calves + hamstrings + trunk stability.
            String focus = "glutes · hamstrings · calves · trunk stability";

            String recoveryHint = "Separate heavy strength from your hardest run by ~24h when possible; "
                    + "if you train both in one day, prefer strength after easy running, not before key sessions.";

            List<String> rationale = new ArrayList<>();
            rationale.add("Weekly running volume estimate uses the last 28 days of runs (km/week).");
            if (intensity.acwr != null) {
                rationale.add("Load ratio (acute vs chronic training load proxy) is used to avoid stacking strength on top of a spike in running stress.");
            }
            rationale.add("Exercise selection favors unilateral + posterior-chain work common in runner S&C programs.");

            List<Map<String, Object>> sessions = buildSessions(level, sessionsPerWeek);

            return new MuscleTrainingRecommendation(weeklyKm, sessionsPerWeek, level, focus, recoveryHint, rationale, sessions);
        }

        Map<String, Object> toResponse() {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("weeklyKmEstimate", round1(weeklyKm));
            root.put("sessionsPerWeek", sessionsPerWeek);
            root.put("level", level);
            root.put("focus", focus);
            root.put("recoveryHint", recoveryHint);
            root.put("rationale", rationale);
            root.put("sessions", sessions);
            return root;
        }

        private static double resolveDistanceKm(Activity a) {
            if (a == null) return 0.0;
            if (a.getDistanceKm() > 0) return a.getDistanceKm();
            Double meters = a.getDistanceMeters();
            if (meters != null && meters > 0) return meters / 1000.0;
            return 0.0;
        }

        private static double round1(double v) {
            return Math.round(v * 10.0) / 10.0;
        }

        private static final class RunIntensitySummary {
            private final Double acwr;

            private RunIntensitySummary(Double acwr) {
                this.acwr = acwr;
            }
        }

        private static RunIntensitySummary summarizeIntensity(List<Activity> recent) {
            // Mirror the frontend EWMA approach loosely in Java for server-side independence.
            LocalDateTime end = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
            LocalDateTime start = end.minusDays(120);

            Map<String, Double> dailyLoads = new LinkedHashMap<>();
            for (Activity a : recent) {
                LocalDateTime t = a.getStartTime();
                if (t == null) continue;
                if (t.isBefore(start) || t.isAfter(end.plusDays(1))) continue;

                double km = resolveDistanceKm(a);
                int movingSec = a.getMovingTimeSeconds();
                if (movingSec <= 0 && a.getDurationSeconds() != null) {
                    movingSec = a.getDurationSeconds().intValue();
                }
                if (movingSec <= 0) continue;

                double durationMin = movingSec / 60.0;
                double paceSecPerKm = km > 0 ? movingSec / km : 0;
                double vo2Fraction = 0.65;
                if (paceSecPerKm > 0) {
                    double v = (1000.0 / paceSecPerKm) * 60.0; // m/min
                    double vo2 = -4.60 + (0.182258 * v) + (0.000104 * v * v);
                    // Match the frontend fallback: approximate %VO2max from pace vs a mid fitness anchor.
                    vo2Fraction = Math.max(0.4, Math.min(1.2, vo2 / 50.0));
                }
                double intensityRatio = vo2Fraction / 0.85;
                double score = (durationMin / 60.0) * intensityRatio * intensityRatio * 100.0;

                String key = t.toLocalDate().toString();
                dailyLoads.merge(key, score, Double::sum);
            }

            if (dailyLoads.isEmpty()) {
                return new RunIntensitySummary(null);
            }

            List<String> keys = new ArrayList<>(dailyLoads.keySet());
            keys.sort(Comparator.naturalOrder());
            if (keys.size() < 7) {
                return new RunIntensitySummary(null);
            }

            double lambdaA = 2.0 / 8.0;
            double lambdaC = 2.0 / 29.0;
            double ewmaA = 0.0;
            double ewmaC = 0.0;
            Double lastAcwr = null;

            for (int i = 0; i < keys.size(); i++) {
                double load = dailyLoads.getOrDefault(keys.get(i), 0.0);
                if (i == 0) {
                    ewmaA = load;
                    ewmaC = load;
                } else {
                    ewmaA = load * lambdaA + (1 - lambdaA) * ewmaA;
                    ewmaC = load * lambdaC + (1 - lambdaC) * ewmaC;
                }
                lastAcwr = ewmaC > 0.5 ? ewmaA / ewmaC : null;
            }

            return new RunIntensitySummary(lastAcwr);
        }

        private static List<Map<String, Object>> buildSessions(String level, int sessionsPerWeek) {
            boolean light = "restart".equals(level) || "new".equals(level) || "deload".equals(level);

            Map<String, Object> a = session("Session A — strength + control", light ? 30 : 40,
                    List.of(
                            block("Warm-up", List.of(
                                    ex("Hip airplanes", light ? "2 x 4/side" : "2 x 5/side"),
                                    ex("Calf raises (slow tempo)", "2 x 12"),
                                    ex("Dead bug", light ? "2 x 6/side" : "2 x 8/side")
                            )),
                            block("Main", List.of(
                                    ex("Split squat", light ? "2 x 6/side" : "3 x 8/side"),
                                    ex("Single-leg Romanian deadlift", light ? "2 x 6/side" : "3 x 8/side"),
                                    ex("Standing calf raise", light ? "2 x 12" : "3 x 12"),
                                    ex("Side plank", light ? "2 x 20s/side" : "3 x 25s/side")
                            )),
                            block("Accessory", List.of(
                                    ex("Glute bridge (pause at top)", "2 x 10"),
                                    ex("Tibialis wall raise", "2 x 15")
                            ))
                    )
            );

            Map<String, Object> b = session("Session B — stiffness + resilience", light ? 25 : 35,
                    List.of(
                            block("Warm-up", List.of(
                                    ex("World’s greatest stretch", "2 x 4/side"),
                                    ex("Ankle dorsiflexion rocks", "2 x 10/side")
                            )),
                            block("Main", List.of(
                                    ex("Step-down (knee tracking)", light ? "2 x 6/side" : "3 x 8/side"),
                                    ex("Hamstring curl (slider or machine)", light ? "2 x 8" : "3 x 10"),
                                    ex("Pallof press", "3 x 10/side"),
                                    ex("Farmer carry (suitcase)", "3 x 20-30m/side")
                            ))
                    )
            );

            Map<String, Object> c = session("Session C — power + elasticity (short)", 20,
                    List.of(
                            block("Prep", List.of(
                                    ex("Pogo hops", "2 x 10"),
                                    ex("Skipping A-drill", "2 x 15m")
                            )),
                            block("Main", List.of(
                                    ex("Box step-up (explosive)", "4 x 5/side"),
                                    ex("Single-leg hop (low amplitude)", "3 x 5/side")
                            ))
                    )
            );

            List<Map<String, Object>> out = new ArrayList<>();
            out.add(a);
            if (sessionsPerWeek >= 2) {
                out.add(b);
            }
            if (sessionsPerWeek >= 3) {
                out.add(c);
            }
            return out;
        }

        private static Map<String, Object> session(String title, int durationMin, List<Map<String, Object>> blocks) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("title", title);
            s.put("durationMin", durationMin);
            s.put("blocks", blocks);
            return s;
        }

        private static Map<String, Object> block(String title, List<Map<String, Object>> exercises) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("title", title);
            b.put("exercises", exercises);
            return b;
        }

        private static Map<String, Object> ex(String name, String prescription) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("name", name);
            e.put("prescription", prescription);
            return e;
        }
    }
}

