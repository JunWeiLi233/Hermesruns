package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity @Table(name="entertainment_groups",indexes=@Index(columnList="runner_id"))
public class EntertainmentGroup {
    @Id @Column(length=36) String id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    @Column(nullable=false) long revision;
    @Column(length=36) String lastRequestId;
    protected EntertainmentGroup() {}
    public String getId() { return id; }
}
