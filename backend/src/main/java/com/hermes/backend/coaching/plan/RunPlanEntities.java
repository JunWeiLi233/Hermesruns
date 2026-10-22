package com.hermes.backend.coaching.plan;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.activity.Activity;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.*;
import java.util.*;

/** Seven planning tables. JSON prescriptions are immutable after insert; only lifecycle fields change. */
@MappedSuperclass
abstract class PlanOwnedRow {
    @Id UUID id=UUID.randomUUID();
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    @Column(name="created_at",nullable=false,updatable=false) Instant createdAt=Instant.now();
    @Column(name="updated_at",nullable=false) Instant updatedAt=Instant.now();
    @PreUpdate void touch(){updatedAt=Instant.now();}
}

@Entity(name="PlanProfile") @Table(name="runner_plan_profile",uniqueConstraints=@UniqueConstraint(columnNames="runner_id"))
class PlanProfile extends PlanOwnedRow {
    @Column(name="ability",nullable=false,length=16) String ability;
    @Column(name="weekly_distance_m",nullable=false) int weeklyDistanceM;
    @Column(name="baseline_runs_per_week",nullable=false) int baselineRunsPerWeek;
    @Column(name="longest_run_m",nullable=false) int longestRunM;
    @Column(name="can_walk_20_minutes",nullable=false) boolean canWalk20Minutes;
    @Column(name="result_distance_m") Integer resultDistanceM;
    @Column(name="result_seconds") Integer resultSeconds;
    @Column(name="result_date") LocalDate resultDate;
    @Column(name="units",nullable=false,length=8) String units;
    @Column(name="time_zone",nullable=false,length=64) String timeZone;
    @Column(name="revision",nullable=false) long revision;
}

@Entity(name="RunPlan") @Table(name="training_plan",indexes=@Index(columnList="runner_id,state"))
class RunPlan extends PlanOwnedRow {
    @Column(name="title",nullable=false,length=120) String title;
    @Column(name="goal_kind",nullable=false,length=16) String goalKind;
    @Column(name="target_distance_m",nullable=false) int targetDistanceM;
    @Column(name="state",nullable=false,length=16) String state="DRAFT";
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="input_snapshot",nullable=false) Map<String,Object> inputSnapshot;
    @Column(name="revision",nullable=false) long revision;
}

@Entity(name="PlanVersion") @Table(name="training_plan_version",uniqueConstraints=@UniqueConstraint(columnNames={"plan_id","ordinal"}))
class PlanVersion extends PlanOwnedRow {
    @Column(name="plan_id",nullable=false,updatable=false) UUID planId;
    @Column(name="ordinal",nullable=false,updatable=false) int ordinal;
    @Column(name="base_revision",nullable=false,updatable=false) long baseRevision;
    @Column(name="state",nullable=false,length=16) String state="READY";
    @Column(name="generator_version",nullable=false,updatable=false,length=80) String generatorVersion=RunPlanEngine.RULES;
    @Column(name="mode",nullable=false,updatable=false,length=16) String mode="ORIGINAL";
    @Column(name="schema_version",nullable=false,updatable=false) int schemaVersion=1;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="input_snapshot",nullable=false,updatable=false) Map<String,Object> inputSnapshot;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="workout_snapshot",nullable=false,updatable=false) List<Map<String,Object>> workoutSnapshot;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name="input_hash",nullable=false,updatable=false,length=64) String inputHash;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name="content_hash",nullable=false,updatable=false,length=64) String contentHash;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name="retained_hash",nullable=false,updatable=false,length=64) String retainedHash;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="warnings",nullable=false,updatable=false) List<String> warnings;
    @Column(name="generation_local_date",nullable=false,updatable=false) LocalDate generationLocalDate;
    @Column(name="start_date",nullable=false,updatable=false) LocalDate startDate;
    @Column(name="end_date",nullable=false,updatable=false) LocalDate endDate;
    @Column(name="time_zone",nullable=false,updatable=false,length=64) String timeZone;
}

@Entity(name="PlanWorkout") @Table(name="training_workout",indexes=@Index(columnList="runner_id,plan_id,local_date"))
class PlanWorkout extends PlanOwnedRow {
    @Column(name="plan_id",nullable=false,updatable=false) UUID planId;
    @Column(name="version_id",nullable=false,updatable=false) UUID versionId;
    @Column(name="local_date",nullable=false,updatable=false) LocalDate localDate;
    @Column(name="workout_type",nullable=false,updatable=false,length=16) String workoutType;
    @Column(name="phase",nullable=false,updatable=false,length=16) String phase;
    @Column(name="state",nullable=false,length=16) String state="PLANNED";
    @Column(name="completion_source",nullable=false,length=16) String completionSource="NONE";
    @Column(name="target_distance_m",updatable=false) Integer targetDistanceM;
    @Column(name="target_duration_s",updatable=false) Integer targetDurationS;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="explanation",nullable=false,updatable=false) Map<String,Object> explanation=Map.of("rules",RunPlanEngine.RULES);
    @Column(name="revision",nullable=false) long revision;
}

@Entity(name="PlanStep") @Table(name="training_workout_step",uniqueConstraints=@UniqueConstraint(columnNames={"workout_id","sequence"}))
class PlanStep extends PlanOwnedRow {
    @Column(name="workout_id",nullable=false,updatable=false) UUID workoutId;
    @Column(name="sequence",nullable=false,updatable=false) int sequence;
    @Column(name="step_type",nullable=false,updatable=false,length=16) String stepType;
    @Column(name="distance_m",updatable=false) Integer distanceM;
    @Column(name="duration_s",updatable=false) Integer durationS;
    @Column(name="repetitions",nullable=false,updatable=false) int repetitions=1;
    @Column(name="pace_min_s_per_km",updatable=false) Integer paceMinSPerKm;
    @Column(name="pace_max_s_per_km",updatable=false) Integer paceMaxSPerKm;
    @Column(name="effort_key",nullable=false,updatable=false,length=80) String effortKey;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="effort_params",nullable=false,updatable=false) Map<String,Object> effortParams=Map.of();
}

@Entity(name="PlanActivityLink") @Table(name="training_activity_link",uniqueConstraints={@UniqueConstraint(columnNames="activity_id"),@UniqueConstraint(columnNames="workout_id")})
class PlanActivityLink extends PlanOwnedRow {
    @Column(name="workout_id",nullable=false,updatable=false) UUID workoutId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="activity_id",nullable=false,updatable=false) Activity activity;
    @Column(name="decision",nullable=false,length=16) String decision;
}

@Entity(name="PlanCommand") @Table(name="training_command_receipt",uniqueConstraints=@UniqueConstraint(columnNames={"runner_id","operation","client_key"}))
class PlanCommand extends PlanOwnedRow {
    @Column(name="operation",nullable=false,length=40) String operation;
    @Column(name="client_key",nullable=false) UUID clientKey;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name="request_hash",nullable=false,length=64) String requestHash;
    @Column(name="response_status",nullable=false) int responseStatus=200;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="result",nullable=false) Map<String,Object> result;
    @Column(name="expires_at",nullable=false) Instant expiresAt;
}
