package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "manual_run_receipt", uniqueConstraints = @UniqueConstraint(name="uk_manual_run_owner_key", columnNames={"runner_id","client_key"}), indexes=@Index(name="idx_manual_run_activity",columnList="activity_id"))
public class ManualRunReceipt {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) private Runner runner;
    @Column(name="client_key",nullable=false,length=36) private String clientKey;
    @Column(nullable=false,length=64) private String requestHash;
    @Column(name="activity_id") private Long activityId;
    @Column(nullable=false) private boolean deleted;
    private Instant startedAt;
    @Column(length=64) private String timeZone;
    private Integer distanceMeters;
    private Integer elapsedSeconds;
    @Column(length=120) private String name;
    @Column(nullable=false) private Instant createdAt;
    public Long getId(){return id;}
    public Runner getRunner(){return runner;} public void setRunner(Runner v){runner=v;}
    public String getClientKey(){return clientKey;} public void setClientKey(String v){clientKey=v;}
    public String getRequestHash(){return requestHash;} public void setRequestHash(String v){requestHash=v;}
    public Long getActivityId(){return activityId;} public void setActivityId(Long v){activityId=v;}
    public boolean isDeleted(){return deleted;} public void setDeleted(boolean v){deleted=v;}
    public Instant getStartedAt(){return startedAt;} public void setStartedAt(Instant v){startedAt=v;}
    public String getTimeZone(){return timeZone;} public void setTimeZone(String v){timeZone=v;}
    public int getDistanceMeters(){return distanceMeters;} public void setDistanceMeters(int v){distanceMeters=v;}
    public int getElapsedSeconds(){return elapsedSeconds;} public void setElapsedSeconds(int v){elapsedSeconds=v;}
    public String getName(){return name;} public void setName(String v){name=v;}
    public void setCreatedAt(Instant v){createdAt=v;}
}
