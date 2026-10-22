package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity @Table(name="entertainment_members",uniqueConstraints=@UniqueConstraint(columnNames={"group_id","runner_id"}),indexes=@Index(columnList="runner_id"))
public class EntertainmentMember {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="group_id",nullable=false) EntertainmentGroup mosaic;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="runner_id",nullable=false) Runner runner;
    protected EntertainmentMember() {}
    EntertainmentMember(EntertainmentGroup mosaic,Runner runner) { this.mosaic=mosaic; this.runner=runner; }
}
