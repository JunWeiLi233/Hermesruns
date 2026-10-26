package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity @Table(name="entertainment_receipts",uniqueConstraints=@UniqueConstraint(columnNames={"runner_id","request_id"}))
public class EntertainmentReceipt {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    @Column(name="request_id",nullable=false,length=36) String requestId;
    @Column(nullable=false,length=128) String operation;
    @Column(nullable=false,length=64) String fingerprint;
    @Column(nullable=false,columnDefinition="text") String resultJson;
    @Column(length=36) String resourceId;
    protected EntertainmentReceipt() {}
}
