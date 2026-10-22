package com.hermes.backend.training;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.runner.Runner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;
import static com.hermes.backend.training.TrainingFailure.check;
import static com.hermes.backend.training.TrainingStore.*;

/** Date-window aggregates must not use the bounded activity browser. */
@RestController
@ConditionalOnProperty(name="app.training-workspace.enabled",havingValue="true")
public class TrainingTotalsController {
    private final TrainingAthletes athletes;
    public TrainingTotalsController(TrainingAthletes athletes) { this.athletes = athletes; }

    @ExceptionHandler(TrainingFailure.class)
    public ResponseEntity<Map<String,Object>> failure(TrainingFailure failure) {
        return ResponseEntity.status(failure.status).body(map("code", failure.getMessage()));
    }

    @GetMapping("/api/training/athletes/{aid}/activities/totals")
    public Map<String,Object> totals(@AuthenticationPrincipal Runner principal, @PathVariable String aid,
            @RequestParam(required=false) String from, @RequestParam(required=false) String through) {
        check(principal != null && !principal.isDeleted(), 401, "SIGN_IN_REQUIRED");
        LocalDate start, end;
        try { start = LocalDate.parse(from); end = LocalDate.parse(through); }
        catch (RuntimeException invalid) { throw new TrainingFailure(422, "INVALID_DATE_RANGE"); }
        check(!start.isAfter(end), 422, "INVALID_DATE_RANGE");
        String subject = id(aid);
        return athletes.db.atomic(() -> {
            String actor = athletes.db.ensure(principal.getId(), principal.getDisplayName(), principal.getTimeZone());
            athletes.db.lock(subject);
            athletes.acl.require(actor, subject, false, null);
            Runner owner = athletes.runner(subject);
            var totals = new LinkedHashMap<String,Map<String,Object>>();
            for (String sport : List.of("Running", "Cycling", "Swimming", "Other"))
                totals.put(sport, map("sport", sport, "sessions", 0, "minutes", 0d, "load", 0d, "unknown", 0));
            var bindings = new HashMap<Long,Map<String,Object>>();
            athletes.db.rows("select activity_id,civil_date from tw_activity where athlete_id=?", subject)
                    .forEach(row -> bindings.put(((Number)row.get("activity_id")).longValue(), row));
            // Apply source restrictions before aggregation, just as the canonical activity reader does.
            var history = athletes.em.createQuery("select a from Activity a where a.runner.id=:owner and (:self=true or a.stravaApiSourced=false)", Activity.class)
                    .setParameter("owner", owner.getId()).setParameter("self", actor.equals(subject)).getResultList();
            for (Activity activity : history) {
                var binding = bindings.get(activity.getId());
                LocalDate day = binding != null && binding.get("civil_date") != null
                        ? LocalDate.parse(binding.get("civil_date").toString()) : ActivityLocalDates.of(activity, owner);
                if (day.isBefore(start) || day.isAfter(end)) continue;
                var entry = athletes.dto(actor, subject, activity, athletes.bind(activity, subject), false);
                var row = totals.getOrDefault(String.valueOf(entry.get("sport")), totals.get("Other"));
                row.put("sessions", ((Number)row.get("sessions")).intValue() + 1);
                row.put("minutes", ((Number)row.get("minutes")).doubleValue() + ((Number)entry.get("minutes")).doubleValue());
                if (entry.get("load") == null) row.put("unknown", ((Number)row.get("unknown")).intValue() + 1);
                else row.put("load", ((Number)row.get("load")).doubleValue() + ((Number)entry.get("load")).doubleValue());
            }
            return map("items", new ArrayList<>(totals.values()), "from", from, "through", through, "complete", true);
        });
    }
}
