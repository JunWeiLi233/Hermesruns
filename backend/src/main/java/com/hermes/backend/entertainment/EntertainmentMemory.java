package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="entertainment_memories",indexes=@Index(columnList="runner_id"))
public class EntertainmentMemory {
    @Id @Column(length=36) String id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    // UTF-16 storage allows 80/1000 supplementary Unicode code points, validated by the service.
    @Column(nullable=false,length=160) String title;
    @Column(nullable=false,length=2000) String body;
    @Column(length=10) String literalDate;
    @Column(nullable=false) Instant createdAt;
    @Column(nullable=false) Instant updatedAt;
    @Column(nullable=false) long revision;
    @Column(length=36) String lastRequestId;
    protected EntertainmentMemory() {}
}
