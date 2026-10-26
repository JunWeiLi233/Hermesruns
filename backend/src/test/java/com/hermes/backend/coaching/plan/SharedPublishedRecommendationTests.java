package com.hermes.backend.coaching.plan;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SharedPublishedRecommendationTests {
    @Test void legacyConsumersReceiveThePublishedWeekTotalsAndPaces() {
        EntityManager em = mock(EntityManager.class);
        RunPlanSelection selection = new RunPlanSelection();
        ReflectionTestUtils.setField(selection,"em",em);
        Runner runner=new Runner(); runner.setId(7L);
        RunPlan plan=new RunPlan(); plan.id=UUID.randomUUID(); plan.inputSnapshot=Map.of("timeZone","UTC","runsPerWeek",5);
        LocalDate today=LocalDate.now(ZoneOffset.UTC), monday=today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<PlanWorkout> days=new ArrayList<>();
        for(int d=0;d<7;d++) { var w=new PlanWorkout(); w.id=UUID.randomUUID(); w.localDate=monday.plusDays(d); w.phase="ADAPT";
            w.workoutType=d==1||d==5?"EASY":"REST"; w.targetDistanceM=d==1?Integer.valueOf(4500):d==5?Integer.valueOf(6000):null; days.add(w); }
        var future = new PlanWorkout(); future.id=UUID.randomUUID(); future.localDate=today.plusDays(7);
        future.phase="ADAPT"; future.workoutType="EASY"; future.targetDistanceM=4500; days.add(future);
        var warmup = new PlanStep(); warmup.workoutId=future.id; warmup.stepType="WARMUP";
        warmup.paceMinSPerKm=350; warmup.paceMaxSPerKm=380;
        var main = new PlanStep(); main.workoutId=future.id; main.stepType="RUN";
        main.paceMinSPerKm=300; main.paceMaxSPerKm=330;
        @SuppressWarnings("unchecked") TypedQuery<RunPlan> plans=mock(TypedQuery.class,RETURNS_SELF);
        @SuppressWarnings("unchecked") TypedQuery<PlanWorkout> workouts=mock(TypedQuery.class,RETURNS_SELF);
        @SuppressWarnings("unchecked") TypedQuery<PlanStep> steps=mock(TypedQuery.class,RETURNS_SELF);
        when(em.createQuery(startsWith("select p from RunPlan"),eq(RunPlan.class))).thenReturn(plans);
        when(plans.getResultList()).thenReturn(List.of(plan));
        when(em.createQuery(startsWith("select w from PlanWorkout"),eq(PlanWorkout.class))).thenReturn(workouts);
        when(workouts.getResultList()).thenReturn(days);
        when(em.createQuery(startsWith("select s from PlanStep"),eq(PlanStep.class))).thenReturn(steps);
        when(steps.getResultList()).thenReturn(List.of(warmup,main));
        var result=selection.legacy(runner,14);
        assertThat(result.targetWeeklyKm()).isEqualTo(10.5);
        assertThat(result.sessionsPerWeek()).isEqualTo(2);
        assertThat(result.sessions()).allMatch(s->!s.date().isBefore(today));
        assertThat(result.reasonCodes()).contains("VERSIONED_PLAN");
        var prescribed=result.sessions().stream().filter(s->s.date().equals(future.localDate)).findFirst().orElseThrow();
        assertThat(prescribed.targetPaceMinSecondsPerKm()).isEqualTo(300);
        assertThat(prescribed.targetPaceMaxSecondsPerKm()).isEqualTo(330);
        var week = selection.weekSessions(runner);
        assertThat(week).hasSize(7);
        assertThat(week).allMatch(s -> !s.date().isBefore(monday) && !s.date().isAfter(monday.plusDays(6)));
        assertThat(week).anySatisfy(s -> {
            assertThat(s.date()).isEqualTo(monday.plusDays(1));
            assertThat(s.distanceKm()).isEqualTo(4.5);
        });
        assertThat(week.stream().filter(s -> s.distanceKm() != null).mapToDouble(s -> s.distanceKm()).sum())
                .isEqualTo(result.targetWeeklyKm());
    }
}
