package com.hermes.backend.entertainment;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="entertainment_invites",uniqueConstraints=@UniqueConstraint(columnNames="token_hash"),indexes={@Index(columnList="group_id"),@Index(columnList="recipient_account_id")})
public class EntertainmentInvite {
    @Id @Column(length=36) String id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) @JoinColumn(name="group_id",nullable=false) EntertainmentGroup mosaic;
    // Address only, never a lookup endpoint. Purger removes addressed invitations when that account disappears.
    @Column(name="recipient_account_id",nullable=false,length=20) String recipientAccountId;
    @Column(name="token_hash",nullable=false,length=64) String tokenHash;
    @Column(nullable=false) Instant expiresAt;
    @Column(nullable=false,length=16) String status="pending";
    protected EntertainmentInvite() {}
}
