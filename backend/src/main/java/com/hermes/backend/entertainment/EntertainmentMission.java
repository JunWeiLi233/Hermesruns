package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity @Table(name="entertainment_missions",uniqueConstraints=@UniqueConstraint(columnNames={"runner_id","mission_id"}))
public class EntertainmentMission {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    @Column(name="mission_id",nullable=false,length=16) String missionId;
    @Column(nullable=false,length=16) String status="available";
    @Column(length=16) String previousStatus;
    @Column(nullable=false) long revision;
    @Column(length=36) String lastRequestId;
    protected EntertainmentMission() {}
    EntertainmentMission(Runner runner,String missionId) { this.runner=runner; this.missionId=missionId; }
}
