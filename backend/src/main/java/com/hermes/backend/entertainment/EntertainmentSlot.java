package com.hermes.backend.entertainment;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;

@Entity @Table(name="entertainment_slots",uniqueConstraints=@UniqueConstraint(columnNames={"group_id","slot_index"}))
public class EntertainmentSlot {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="group_id",nullable=false) EntertainmentGroup mosaic;
    @Column(name="slot_index",nullable=false) int slotIndex;
    @Column(length=16) String symbol;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="runner_id") Runner runner;
    protected EntertainmentSlot() {}
    EntertainmentSlot(EntertainmentGroup mosaic,int index) { this.mosaic=mosaic; this.slotIndex=index; }
}
