package com.hermes.backend.entertainment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import jakarta.persistence.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Optional account-owned entertainment. No activity, coaching or reward dependency. */
@Service
public class EntertainmentService {
    public static final List<String> ACCESSORIES=List.of("scarf","cap","satchel");
    public static final List<String> BACKGROUNDS=List.of("meadow","night");
    public static final List<String> MISSIONS=List.of("rest","reflection","story","walk-jog");
    public static final List<String> SYMBOLS=List.of("sun","leaf","star","wave");
    @PersistenceContext private EntityManager em;
    private final RunnerRepository runners;
    private final Clock clock;
    private final ObjectMapper json;
    private final SecureRandom random=new SecureRandom();
    public EntertainmentService(RunnerRepository runners,Clock clock,ObjectMapper json) {
        this.runners=runners; this.clock=clock; this.json=json;
    }

    @Transactional
    public Object read(Long accountId,String resource,String id) {
        Runner owner=lockedOwner(accountId);
        return switch(resource) {
            case "metadata" -> fields("accountId",accountId.toString(),"accessories",ACCESSORIES,"backgrounds",BACKGROUNDS,
                "missionCatalog",MISSIONS,"symbols",SYMBOLS,"slotCount",4,"maxMembers",4);
            case "companion" -> companion(preference(accountId));
            case "memories" -> id==null ? memories(accountId) : memory(ownedMemory(accountId,id));
            case "missions" -> missions(accountId);
            case "groups" -> id==null ? groups(accountId) : group(memberGroup(accountId,id),accountId);
            case "requests" -> {
                EntertainmentReceipt receipt=receipt(accountId,id);
                if(receipt==null) throw missing();
                yield fields("requestId",receipt.requestId,"operation",receipt.operation,"result",decode(receipt.resultJson));
            }
            case "me" -> fields("accountId",owner.getId().toString(),"companion",companion(preference(accountId)),
                "memories",memories(accountId),"missions",missions(accountId),"groups",groups(accountId));
            default -> throw missing();
        };
    }

    @Transactional
    public Map<String,Object> mutate(Long accountId,String action,String id,Integer index,Map<String,Object> body) {
        Runner owner=lockedOwner(accountId);
        String requestId=uuid(body.get("requestId"));
        String operation=action+(id==null ? "" : "/"+id)+(index==null ? "" : "/"+index);
        // Canonical key order: exact semantic JSON retry, independent of object property ordering.
        String fingerprint=hash(requestId+"\n"+operation+"\n"+encode(new TreeMap<>(body)));
        EntertainmentReceipt previous=receipt(accountId,requestId);
        if(previous!=null) {
            if(!previous.operation.equals(operation)||!previous.fingerprint.equals(fingerprint))
                throw conflict("REQUEST_REUSED","Use a new request ID for a different command.");
            return decode(previous.resultJson);
        }
        Map<String,Object> result=switch(action) {
            case "companion.save" -> saveCompanion(owner,body,requestId);
            case "memory.create" -> createMemory(owner,body,requestId);
            case "memory.update" -> updateMemory(owner,id,body,requestId);
            case "memory.delete" -> deleteMemory(owner,id,body);
            case "mission.action" -> mission(owner,id,body,requestId);
            case "group.create" -> createGroup(owner,requestId);
            case "group.slot" -> writeSlot(owner,id,index,body,requestId);
            case "group.invite" -> createInvite(owner,id,body,requestId);
            case "invite.accept","invite.decline" -> redeem(owner,body,action.equals("invite.accept"),requestId);
            case "group.revoke" -> revoke(owner,id,body,requestId);
            case "group.leave" -> leave(owner,id,body,requestId);
            case "group.delete" -> deleteGroup(owner,id,body);
            default -> throw bad("Unknown command.");
        };
        EntertainmentReceipt saved=new EntertainmentReceipt();
        saved.runner=owner; saved.requestId=requestId; saved.operation=operation; saved.fingerprint=fingerprint;
        Map<String,Object> retained=new LinkedHashMap<>(result);
        if(action.equals("group.invite")) retained.put("token",null);
        saved.resultJson=encode(retained);
        saved.resourceId=action.startsWith("memory.") ? (String)result.get("id") : null;
        if(action.startsWith("group.")||action.equals("invite.accept")) {
            Map<String,Object> snapshot=groupSnapshot(retained);
            saved.resourceId=snapshot==null ? (String)retained.get("id") : (String)snapshot.get("id");
        }
        em.persist(saved);
        em.flush();
        return result;
    }

    private Map<String,Object> saveCompanion(Runner owner,Map<String,Object> b,String requestId) {
        EntertainmentPreferences p=preference(owner.getId());
        version(b,p==null?0:p.revision);
        String accessory=text(b,"accessory"), background=text(b,"background");
        if(!ACCESSORIES.contains(accessory)||!BACKGROUNDS.contains(background)||!(b.get("hidden") instanceof Boolean))
            throw bad("Choose a supplied accessory, background and visibility.");
        if(p==null) { p=new EntertainmentPreferences(owner); em.persist(p); }
        p.accessory=accessory; p.background=background; p.hidden=(Boolean)b.get("hidden"); p.revision++; p.lastRequestId=requestId;
        return companion(p);
    }
    private Map<String,Object> createMemory(Runner owner,Map<String,Object> b,String requestId) {
        validateMemory(b);
        EntertainmentMemory m=new EntertainmentMemory(); m.id=UUID.randomUUID().toString(); m.runner=owner;
        m.createdAt=storedNow(); m.updatedAt=m.createdAt;
        assignMemory(m,b,requestId); em.persist(m);
        return memory(m);
    }
    private Map<String,Object> updateMemory(Runner owner,String id,Map<String,Object> b,String requestId) {
        EntertainmentMemory m=ownedMemory(owner.getId(),id); version(b,m.revision); validateMemory(b);
        assignMemory(m,b,requestId); m.updatedAt=storedNow(); m.revision++;
        return memory(m);
    }
    private Map<String,Object> deleteMemory(Runner owner,String id,Map<String,Object> b) {
        EntertainmentMemory m=ownedMemory(owner.getId(),id); version(b,m.revision); em.remove(m);
        Map<String,Object> tombstone=fields("id",id,"deleted",true);
        // Removing a card also removes its private content from older response-loss receipts.
        em.createQuery("update EntertainmentReceipt r set r.resultJson=:result where r.runner.id=:owner and r.resourceId=:id")
            .setParameter("result",encode(tombstone)).setParameter("owner",owner.getId()).setParameter("id",id).executeUpdate();
        return tombstone;
    }
    private void assignMemory(EntertainmentMemory m,Map<String,Object> b,String requestId) {
        m.title=(String)b.get("title"); m.body=(String)b.get("body"); m.literalDate=(String)b.get("date"); m.lastRequestId=requestId;
    }
    private void validateMemory(Map<String,Object> b) {
        String title=text(b,"title"), body=text(b,"body");
        if(title.isBlank()||title.codePointCount(0,title.length())>80||body.codePointCount(0,body.length())>1000)
            throw bad("Title must be nonblank and at most 80 characters; body at most 1000.");
        Object literal=b.get("date");
        if(literal!=null) {
            if(!(literal instanceof String date)||!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw bad("Use a literal YYYY-MM-DD date.");
            try { LocalDate.parse(date); } catch(DateTimeParseException invalid) { throw bad("Use a valid calendar date."); }
        }
    }
    private Map<String,Object> mission(Runner owner,String id,Map<String,Object> b,String requestId) {
        if(!MISSIONS.contains(id)) throw bad("Choose a supplied mission.");
        EntertainmentMission m=one("select m from EntertainmentMission m where m.runner.id=:owner and m.missionId=:mission",
            EntertainmentMission.class,"owner",owner.getId(),"mission",id);
        version(b,m==null?0:m.revision);
        if(m==null) m=new EntertainmentMission(owner,id);
        String action=text(b,"action"), next;
        switch(action) {
            case "choose" -> next="chosen";
            case "pause" -> {
                if(!List.of("chosen","paused").contains(m.status)) throw bad("Choose the mission before pausing."); next="paused";
            }
            case "complete" -> {
                if(!List.of("chosen","paused","completed").contains(m.status)) throw bad("Choose the mission before marking it complete."); next="completed";
            }
            case "skip" -> {
                if(m.status.equals("completed")) throw bad("Undo completion before skipping."); next="skipped";
            }
            case "undo" -> {
                if(m.previousStatus==null) throw bad("There is no action to undo."); next=m.previousStatus; m.previousStatus=null;
            }
            default -> throw bad("Unknown mission action.");
        }
        if(!next.equals(m.status)) {
            if(!action.equals("undo")) m.previousStatus=m.status;
            m.status=next;
        }
        m.revision++; m.lastRequestId=requestId;
        if(m.id==null) em.persist(m);
        return missionState(m,id);
    }
    private Map<String,Object> createGroup(Runner owner,String requestId) {
        EntertainmentGroup g=new EntertainmentGroup(); g.id=UUID.randomUUID().toString(); g.runner=owner; g.lastRequestId=requestId;
        em.persist(g); em.persist(new EntertainmentMember(g,owner));
        for(int i=0;i<4;i++) em.persist(new EntertainmentSlot(g,i));
        em.flush(); return group(g,owner.getId());
    }
    private Map<String,Object> writeSlot(Runner owner,String id,Integer index,Map<String,Object> b,String requestId) {
        EntertainmentGroup g=memberGroup(owner.getId(),id); version(b,g.revision);
        if(index==null||index<0||index>=4) throw bad("Choose a fixed mosaic slot.");
        Object symbol=b.get("symbol");
        if(!b.containsKey("symbol")||(symbol!=null&&!SYMBOLS.contains(symbol))) throw bad("Choose a supplied mosaic symbol.");
        EntertainmentSlot slot=one("select s from EntertainmentSlot s where s.mosaic.id=:group and s.slotIndex=:index",
            EntertainmentSlot.class,"group",id,"index",index);
        slot.symbol=(String)symbol; slot.runner=symbol==null?null:owner;
        changed(g,requestId); em.flush(); return group(g,owner.getId());
    }
    private Map<String,Object> createInvite(Runner owner,String id,Map<String,Object> b,String requestId) {
        EntertainmentGroup g=ownerGroup(owner.getId(),id); version(b,g.revision);
        String recipient=text(b,"recipientAccountId");
        if(!recipient.matches("[1-9][0-9]{0,18}")) throw bad("Use the recipient's own account ID.");
        try { Long.parseLong(recipient); } catch(NumberFormatException invalid) { throw bad("Invalid account ID."); }
        if(recipient.equals(owner.getId().toString())||members(g.id).stream().anyMatch(m->m.runner.getId().toString().equals(recipient)))
            throw bad("Invite a different account that is not already a member.");
        byte[] entropy=new byte[32]; random.nextBytes(entropy);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(entropy);
        EntertainmentInvite inv=new EntertainmentInvite(); inv.id=UUID.randomUUID().toString(); inv.mosaic=g;
        inv.recipientAccountId=recipient; inv.tokenHash=hash(token); inv.expiresAt=storedNow().plusSeconds(86400);
        em.persist(inv); changed(g,requestId); em.flush();
        return fields("inviteId",inv.id,"token",token,"expiresAt",inv.expiresAt.toString(),"group",group(g,owner.getId()));
    }
    private Map<String,Object> redeem(Runner recipient,Map<String,Object> b,boolean accept,String requestId) {
        String token=text(b,"token"); if(!token.matches("[A-Za-z0-9_-]{43}")) throw missing();
        EntertainmentInvite inv=one("select i from EntertainmentInvite i where i.tokenHash=:hash",EntertainmentInvite.class,"hash",hash(token));
        if(inv==null||!inv.recipientAccountId.equals(recipient.getId().toString())) throw missing();
        // Look up by hash, then lock the single group before refreshing invitation status.
        // All invite revokes, redemptions, memberships and slot changes take this same lock.
        EntertainmentGroup g=lockedGroup(inv.mosaic.getId());
        em.refresh(inv);
        if(!inv.status.equals("pending")||!clock.instant().isBefore(inv.expiresAt))
            throw new EntertainmentProblem(410,"INVITE_UNAVAILABLE","Invitation expired, used or revoked.");
        if(accept) {
            List<EntertainmentMember> members=members(g.id);
            if(members.stream().anyMatch(m->m.runner.getId().equals(recipient.getId()))) throw conflict("ALREADY_MEMBER","This account is already a member.");
            if(members.size()>=4) throw conflict("GROUP_FULL","This mosaic already has four members.");
            em.persist(new EntertainmentMember(g,recipient)); inv.status="accepted";
        } else inv.status="declined";
        changed(g,requestId); em.flush();
        return accept ? group(g,recipient.getId()) : fields("declined",true);
    }
    private Map<String,Object> revoke(Runner owner,String compoundId,Map<String,Object> b,String requestId) {
        String[] parts=compoundId.split("/",2);
        if(parts.length!=2) throw missing();
        EntertainmentGroup g=ownerGroup(owner.getId(),parts[0]); version(b,g.revision);
        EntertainmentInvite inv=em.find(EntertainmentInvite.class,parts[1]);
        if(inv==null||!inv.mosaic.getId().equals(g.id)) throw missing();
        if(!inv.status.equals("pending")&&!inv.status.equals("revoked")) throw conflict("INVITE_USED","This invitation has already been answered.");
        inv.status="revoked"; changed(g,requestId); em.flush(); return group(g,owner.getId());
    }
    private Map<String,Object> leave(Runner member,String id,Map<String,Object> b,String requestId) {
        EntertainmentGroup g=memberGroup(member.getId(),id); version(b,g.revision);
        if(g.runner.getId().equals(member.getId())) throw bad("The owner must delete the mosaic to leave.");
        clearMember(g.id,member.getId()); changed(g,requestId);
        return fields("id",id,"left",true);
    }
    private Map<String,Object> deleteGroup(Runner owner,String id,Map<String,Object> b) {
        EntertainmentGroup g=ownerGroup(owner.getId(),id); version(b,g.revision); eraseGroup(g);
        return fields("id",id,"deleted",true);
    }
    void clearMember(String groupId,Long accountId) {
        em.createQuery("update EntertainmentSlot s set s.runner=null,s.symbol=null where s.mosaic.id=:group and s.runner.id=:owner")
            .setParameter("group",groupId).setParameter("owner",accountId).executeUpdate();
        em.createQuery("delete from EntertainmentMember m where m.mosaic.id=:group and m.runner.id=:owner")
            .setParameter("group",groupId).setParameter("owner",accountId).executeUpdate();
        // Previously accepted invitations cannot become a way to rejoin after leaving.
        em.createQuery("delete from EntertainmentInvite i where i.mosaic.id=:group and i.recipientAccountId=:owner")
            .setParameter("group",groupId).setParameter("owner",accountId.toString()).executeUpdate();
        scrubGroupReceipts(groupId,accountId.toString());
    }
    void eraseGroup(EntertainmentGroup g) {
        scrubGroupReceipts(g.id,null);
        for(String entity:List.of("EntertainmentInvite","EntertainmentSlot","EntertainmentMember"))
            em.createQuery("delete from "+entity+" e where e.mosaic.id=:group").setParameter("group",g.id).executeUpdate();
        em.remove(g); em.flush();
    }
    @SuppressWarnings("unchecked")
    private Map<String,Object> groupSnapshot(Map<String,Object> result) {
        if(result.get("group") instanceof Map<?,?> nested) return (Map<String,Object>)nested;
        return result.containsKey("members")&&result.containsKey("slots") ? result : null;
    }
    @SuppressWarnings("unchecked")
    private void scrubGroupReceipts(String groupId,String departingAccount) {
        // Receipt copies are private, but they must not defeat leave/account/group deletion.
        // The group lock serializes this cleanup with every command producing a new group snapshot.
        List<EntertainmentReceipt> receipts=em.createQuery("""
            select r from EntertainmentReceipt r
            where (r.resourceId=:group or r.resourceId is null)
              and (r.operation like 'group.%' or r.operation='invite.accept')
            order by r.id
            """,EntertainmentReceipt.class).setParameter("group",groupId).getResultList();
        for(EntertainmentReceipt receipt:receipts) {
            Map<String,Object> result=decode(receipt.resultJson), snapshot=groupSnapshot(result);
            String snapshotId=snapshot==null ? (String)result.get("id") : (String)snapshot.get("id");
            if(!groupId.equals(snapshotId)) continue;
            if(departingAccount==null) receipt.resultJson=encode(fields("id",groupId,"deleted",true));
            else if(snapshot!=null) {
                List<Map<String,Object>> members=(List<Map<String,Object>>)snapshot.get("members");
                snapshot.put("members",members.stream().filter(m->!departingAccount.equals(m.get("accountId"))).toList());
                List<Map<String,Object>> slots=(List<Map<String,Object>>)snapshot.get("slots");
                for(Map<String,Object> slot:slots) if(departingAccount.equals(slot.get("contributorAccountId"))) {
                    slot.put("symbol",null); slot.put("contributorAccountId",null);
                }
                List<Map<String,Object>> invites=(List<Map<String,Object>>)snapshot.get("invites");
                snapshot.put("invites",invites.stream().filter(i->!departingAccount.equals(i.get("recipientAccountId"))).toList());
                snapshot.put("complete",slots.size()==4&&slots.stream().allMatch(s->s.get("symbol")!=null));
                receipt.resultJson=encode(result);
            }
        }
        em.flush();
        // Purger may bulk-delete this account's receipts before removing Runner. Do not leave
        // managed copies pointing at the removed account after their SQL deletion.
        receipts.forEach(em::detach);
    }
    EntertainmentGroup lockedGroup(String id) {
        EntertainmentGroup g=existingLockedGroup(id);
        if(g==null) throw missing();
        return g;
    }
    EntertainmentGroup existingLockedGroup(String id) {
        EntertainmentGroup g=em.createQuery("select g from EntertainmentGroup g where g.id=:id",EntertainmentGroup.class)
            .setParameter("id",id).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultStream().findFirst().orElse(null);
        if(g==null) return null;
        // A preceding invitation/member query may have populated the persistence context.
        em.refresh(g,LockModeType.PESSIMISTIC_WRITE);
        return org.hibernate.Hibernate.unproxy(g,EntertainmentGroup.class);
    }
    private EntertainmentGroup memberGroup(Long accountId,String id) {
        EntertainmentGroup g=lockedGroup(id);
        if(members(id).stream().noneMatch(m->m.runner.getId().equals(accountId))) throw missing();
        return g;
    }
    private EntertainmentGroup ownerGroup(Long accountId,String id) {
        EntertainmentGroup g=lockedGroup(id); if(!g.runner.getId().equals(accountId)) throw missing(); return g;
    }
    private Runner lockedOwner(Long id) {
        return runners.findByIdForUpdate(id).filter(r->!r.isDeleted())
            .orElseThrow(()->new EntertainmentProblem(401,"SIGN_IN_REQUIRED","Sign in required."));
    }
    private EntertainmentPreferences preference(Long id) {
        return one("select p from EntertainmentPreferences p where p.runner.id=:owner",EntertainmentPreferences.class,"owner",id);
    }
    private EntertainmentMemory ownedMemory(Long accountId,String id) {
        EntertainmentMemory m=one("select m from EntertainmentMemory m where m.id=:id and m.runner.id=:owner",
            EntertainmentMemory.class,"id",id,"owner",accountId);
        if(m==null) throw missing(); return m;
    }
    private EntertainmentReceipt receipt(Long owner,String requestId) {
        return one("select r from EntertainmentReceipt r where r.runner.id=:owner and r.requestId=:request",
            EntertainmentReceipt.class,"owner",owner,"request",requestId);
    }
    private List<Map<String,Object>> memories(Long owner) {
        return em.createQuery("select m from EntertainmentMemory m where m.runner.id=:owner order by m.createdAt,m.id",EntertainmentMemory.class)
            .setParameter("owner",owner).getResultList().stream().map(this::memory).toList();
    }
    private List<Map<String,Object>> missions(Long owner) {
        List<EntertainmentMission> rows=em.createQuery("select m from EntertainmentMission m where m.runner.id=:owner",EntertainmentMission.class)
            .setParameter("owner",owner).getResultList();
        return MISSIONS.stream().map(id->missionState(rows.stream().filter(m->m.missionId.equals(id)).findFirst().orElse(null),id)).toList();
    }
    private List<Map<String,Object>> groups(Long owner) {
        List<String> ids=em.createQuery("select m.mosaic.id from EntertainmentMember m where m.runner.id=:owner order by m.mosaic.id",String.class)
            .setParameter("owner",owner).getResultList();
        List<Map<String,Object>> result=new ArrayList<>();
        for(String id:ids) {
            // A group owner may have deleted it while this member's list query was waiting.
            EntertainmentGroup g=existingLockedGroup(id);
            if(g!=null&&members(id).stream().anyMatch(m->m.runner.getId().equals(owner))) result.add(group(g,owner));
        }
        return result;
    }
    private List<EntertainmentMember> members(String id) {
        return em.createQuery("select m from EntertainmentMember m where m.mosaic.id=:group order by m.runner.id",EntertainmentMember.class)
            .setParameter("group",id).getResultList();
    }
    private Map<String,Object> group(EntertainmentGroup g,Long viewer) {
        List<Map<String,Object>> slots=em.createQuery("select s from EntertainmentSlot s where s.mosaic.id=:group order by s.slotIndex",EntertainmentSlot.class)
            .setParameter("group",g.id).getResultList().stream()
            .map(s->fields("index",s.slotIndex,"symbol",s.symbol,"contributorAccountId",s.runner==null?null:s.runner.getId().toString())).toList();
        List<Map<String,Object>> invites=g.runner.getId().equals(viewer) ?
            em.createQuery("select i from EntertainmentInvite i where i.mosaic.id=:group order by i.id",EntertainmentInvite.class)
                .setParameter("group",g.id).getResultList().stream()
                .map(i->fields("id",i.id,"recipientAccountId",i.recipientAccountId,"expiresAt",i.expiresAt.toString(),
                    "status",i.status.equals("pending")&&!clock.instant().isBefore(i.expiresAt)?"expired":i.status)).toList() : List.of();
        return fields("id",g.id,"ownerAccountId",g.runner.getId().toString(),"version",g.revision,"lastRequestId",g.lastRequestId,
            "members",members(g.id).stream().map(m->fields("accountId",m.runner.getId().toString())).toList(),"slots",slots,
            "complete",slots.size()==4&&slots.stream().allMatch(s->s.get("symbol")!=null),"invites",invites);
    }
    private Map<String,Object> companion(EntertainmentPreferences p) {
        return fields("accessory",p==null?"scarf":p.accessory,"background",p==null?"meadow":p.background,
            "hidden",p!=null&&p.hidden,"version",p==null?0:p.revision,"lastRequestId",p==null?null:p.lastRequestId);
    }
    private Map<String,Object> memory(EntertainmentMemory m) {
        return fields("id",m.id,"title",m.title,"body",m.body,"date",m.literalDate,"createdAt",m.createdAt.toString(),
            "updatedAt",m.updatedAt.toString(),"version",m.revision,"lastRequestId",m.lastRequestId);
    }
    private Map<String,Object> missionState(EntertainmentMission m,String id) {
        return fields("missionId",id,"status",m==null?"available":m.status,"completionSource","self-marked",
            "version",m==null?0:m.revision,"lastRequestId",m==null?null:m.lastRequestId);
    }
    private void changed(EntertainmentGroup g,String requestId) { g.revision++; g.lastRequestId=requestId; }
    private Instant storedNow() { return clock.instant().truncatedTo(ChronoUnit.MICROS); }
    private void version(Map<String,Object> b,long current) {
        Object value=b.get("expectedVersion");
        if(!(value instanceof Integer||value instanceof Long)||((Number)value).longValue()<0) throw bad("A nonnegative integer expectedVersion is required.");
        if(((Number)value).longValue()!=current) throw conflict("VERSION_CONFLICT","This item changed. Reload it before saving your draft.");
    }
    private String uuid(Object value) {
        if(!(value instanceof String id)||!id.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))
            throw bad("A UUID requestId is required.");
        return UUID.fromString(id).toString();
    }
    private String text(Map<String,Object> b,String key) {
        if(!(b.get(key) instanceof String value)) throw bad(key+" must be a string."); return value;
    }
    private <T> T one(String hql,Class<T> type,Object... params) {
        TypedQuery<T> q=em.createQuery(hql,type);
        for(int i=0;i<params.length;i+=2) q.setParameter((String)params[i],params[i+1]);
        return q.getResultStream().findFirst().orElse(null);
    }
    static Map<String,Object> fields(Object... values) {
        Map<String,Object> result=new LinkedHashMap<>(); for(int i=0;i<values.length;i+=2) result.put((String)values[i],values[i+1]); return result;
    }
    private String encode(Object value) {
        try { return json.writeValueAsString(value); } catch(Exception invalid) { throw new IllegalStateException("Cannot encode entertainment state",invalid); }
    }
    private Map<String,Object> decode(String value) {
        try { return json.readValue(value,new TypeReference<Map<String,Object>>(){}); }
        catch(Exception invalid) { throw new IllegalStateException("Cannot read entertainment receipt",invalid); }
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private static EntertainmentProblem bad(String message) { return new EntertainmentProblem(400,"INVALID_REQUEST",message); }
    private static EntertainmentProblem missing() { return new EntertainmentProblem(404,"NOT_FOUND","Item not found."); }
    private static EntertainmentProblem conflict(String code,String message) { return new EntertainmentProblem(409,code,message); }
}
