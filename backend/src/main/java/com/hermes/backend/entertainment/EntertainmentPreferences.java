package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity @Table(name="entertainment_preferences", uniqueConstraints=@UniqueConstraint(columnNames="runner_id"))
public class EntertainmentPreferences {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    @Column(nullable=false,length=16) String accessory="scarf";
    @Column(nullable=false,length=16) String background="meadow";
    @Column(nullable=false) boolean hidden;
    @Column(nullable=false) long revision;
    @Column(length=36) String lastRequestId;
    protected EntertainmentPreferences() {}
    EntertainmentPreferences(Runner runner) { this.runner=runner; }
}
