package com.hermes.backend.activity;

import com.hermes.backend.infrastructure.web.InputSanitizer;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManualRunService {
    private final RunnerRepository runners;
    private final ActivityRepository activities;
    private final ManualRunReceiptRepository receipts;
    private final ApplicationEventPublisher events;
    public ManualRunService(RunnerRepository runners,ActivityRepository activities,ManualRunReceiptRepository receipts,ApplicationEventPublisher events){
        this.runners=runners;this.activities=activities;this.receipts=receipts;this.events=events;
    }
    public record Request(String clientKey,String startedAt,String timeZone,Integer distanceMeters,Integer elapsedSeconds,String name){}
    public record Result(String id,String name,int distanceMeters,int elapsedSeconds,String startedAt,String timeZone,boolean replayed){}
    public static class Conflict extends RuntimeException {public final String code;public final int status;Conflict(String code,int status){super(code);this.code=code;this.status=status;}}

    @Transactional
    public Result save(Long runnerId,Request request){
        if(request==null)throw new IllegalArgumentException("Run details are required.");
        String key;Instant started;ZoneId zone;
        try {key=UUID.fromString(request.clientKey()).toString();started=Instant.parse(request.startedAt());zone=ZoneId.of(request.timeZone());}
        catch(RuntimeException invalid){throw new IllegalArgumentException("A valid save key, start instant and time zone are required.");}
        if(request.distanceMeters()==null||request.distanceMeters()<1||request.distanceMeters()>1_000_000
            ||request.elapsedSeconds()==null||request.elapsedSeconds()<1||request.elapsedSeconds()>604_800)
            throw new IllegalArgumentException("Distance and elapsed time must be positive and within input limits.");
        if(started.isAfter(Instant.now().plusSeconds(300)))throw new IllegalArgumentException("The run cannot start in the future.");
        String name=request.name()==null?"":request.name().trim();
        if(name.isBlank()||name.length()>120)throw new IllegalArgumentException("The run name must contain 1 to 120 characters.");
        InputSanitizer.rejectControlAndHtmlChars(name,"name");
        String hash=digest(String.join("\n",started.toString(),zone.getId(),request.distanceMeters().toString(),request.elapsedSeconds().toString(),name));
        Runner owner=runners.findByIdForUpdate(runnerId).filter(r->!r.isDeleted()).orElseThrow(()->new Conflict("SESSION_EXPIRED",401));
        var previous=receipts.findByRunnerIdAndClientKey(runnerId,key);
        if(previous.isPresent()){
            var receipt=previous.get();
            if(!hash.equals(receipt.getRequestHash()))throw new Conflict("SAVE_KEY_REUSED",409);
            if(receipt.isDeleted()||receipt.getActivityId()==null||activities.findByIdAndRunner(receipt.getActivityId(),owner).isEmpty())throw new Conflict("RUN_DELETED",410);
            return result(receipt,true);
        }
        Activity run=new Activity();run.setRunner(owner);run.setName(name);run.setProvider(ImportProvider.MANUAL);run.setActivityType(ActivityType.RUN);
        run.setDistanceKm(request.distanceMeters()/1000d);run.setDistanceMeters(request.distanceMeters().doubleValue());
        run.setMovingTimeSeconds(request.elapsedSeconds());run.setDurationSeconds(request.elapsedSeconds().longValue());
        run.setStartTime(LocalDateTime.ofInstant(started,ZoneOffset.UTC));run.setStartDate(started.toString());run.setSourceChecksum(digest("MANUAL:"+key));
        run.setStravaApiSourced(false);run.setSourceFileName("manual-entry");
        Activity saved=activities.saveAndFlush(run);
        ManualRunReceipt receipt=new ManualRunReceipt();receipt.setRunner(owner);receipt.setClientKey(key);receipt.setRequestHash(hash);
        receipt.setActivityId(saved.getId());receipt.setStartedAt(started);receipt.setTimeZone(zone.getId());receipt.setDistanceMeters(request.distanceMeters());
        receipt.setElapsedSeconds(request.elapsedSeconds());receipt.setName(name);receipt.setCreatedAt(Instant.now());receipts.saveAndFlush(receipt);
        events.publishEvent(new ActivityIngestedEvent(runnerId,saved.getId()));
        return result(receipt,false);
    }
    private Result result(ManualRunReceipt r,boolean replayed){return new Result(r.getActivityId().toString(),r.getName(),r.getDistanceMeters(),r.getElapsedSeconds(),r.getStartedAt().toString(),r.getTimeZone(),replayed);}
    private static String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception impossible){throw new IllegalStateException(impossible);}}
}
