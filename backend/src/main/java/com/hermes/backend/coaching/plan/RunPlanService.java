package com.hermes.backend.coaching.plan;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import com.hermes.backend.activity.*;
import com.hermes.backend.runner.*;
import jakarta.persistence.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;

@Service
public class RunPlanService {
    @PersistenceContext EntityManager em;
    private final ObjectMapper json;
    private final RunnerRepository runners;
    private final ActivityRepository activities;
    private final TransactionTemplate tx;
    private final RunPlanEngine engine=new RunPlanEngine();
    private final boolean approved;
    private final boolean experimental;
    public RunPlanService(ObjectMapper json,RunnerRepository runners,ActivityRepository activities,
        PlatformTransactionManager transactions,String approval) {
        this(json,runners,activities,transactions,approval,"");
    }
    @org.springframework.beans.factory.annotation.Autowired
    public RunPlanService(ObjectMapper json,RunnerRepository runners,ActivityRepository activities,
        PlatformTransactionManager transactions,@Value("${app.run-plans.approved-ruleset:}") String approval,
        @Value("${app.run-plans.experimental-ruleset:}") String experimentalRuleset) {
        this.json=json.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT);
        var dates=new com.fasterxml.jackson.databind.module.SimpleModule();
        dates.addSerializer(LocalDate.class,new JsonSerializer<LocalDate>(){public void serialize(LocalDate value,com.fasterxml.jackson.core.JsonGenerator g,SerializerProvider p)throws java.io.IOException{g.writeString(value.toString());}});
        dates.addDeserializer(LocalDate.class,new JsonDeserializer<LocalDate>(){public LocalDate deserialize(com.fasterxml.jackson.core.JsonParser p,DeserializationContext c)throws java.io.IOException{return LocalDate.parse(p.getValueAsString());}});
        dates.addSerializer(LocalDateTime.class,new JsonSerializer<LocalDateTime>(){public void serialize(LocalDateTime value,com.fasterxml.jackson.core.JsonGenerator g,SerializerProvider p)throws java.io.IOException{g.writeString(value.toString());}});
        this.json.registerModule(dates);
        this.runners=runners;this.activities=activities;this.tx=new TransactionTemplate(transactions);
        this.approved=RunPlanEngine.RULES.equals(approval);
        this.experimental=!approved&&RunPlanEngine.RULES.equals(experimentalRuleset);
    }
    public static class Failure extends RuntimeException {
        public final int status;public final String code;public final List<String> fields;
        public Failure(int status,String code,String... fields){super(code);this.status=status;this.code=code;this.fields=List.of(fields);}
    }
    static void check(boolean yes,int status,String code,String... fields){if(!yes)throw new Failure(status,code,fields);}
    static UUID uuid(String value){try{return UUID.fromString(value);}catch(RuntimeException e){throw new Failure(400,"INVALID_ID");}}
    static long number(Map<String,Object> b,String key){Object v=b.get(key);check(v instanceof Number && ((Number)v).doubleValue()==((Number)v).longValue(),400,"INVALID_INPUT",key);return ((Number)v).longValue();}
    static String text(Map<String,Object> b,String key){Object v=b.get(key);check(v instanceof String,400,"INVALID_INPUT",key);return (String)v;}
    static Map<String,Object> map(Object... pairs){Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)m.put((String)pairs[i],pairs[i+1]);return m;}
    <T> List<T> owned(Class<T> type,Runner r,String suffix,Map<String,Object> params,int limit){
        var q=em.createQuery("select x from "+em.getMetamodel().entity(type).getName()+" x where x.runner.id=:owner "+suffix,type).setParameter("owner",r.getId()).setMaxResults(limit);
        params.forEach(q::setParameter);return q.getResultList();
    }
    private <T extends PlanOwnedRow> T row(Class<T> type,Runner owner,UUID id,boolean lock){
        var q=em.createQuery("select x from "+em.getMetamodel().entity(type).getName()+" x where x.runner.id=:owner and x.id=:id",type)
            .setParameter("owner",owner.getId()).setParameter("id",id);
        if(lock)q.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        return q.getResultStream().findFirst().orElseThrow(()->new Failure(404,"NOT_FOUND"));
    }
    private RunPlan active(Runner owner){return owned(RunPlan.class,owner,"and x.state='ACTIVE'",Map.of(),1).stream().findFirst().orElse(null);}
    private RunPlan generated(RunPlan plan){check(!"EXTERNAL".equals(plan.state),409,"EXTERNAL_PLAN");return plan;}
    private RunPlanEngine.Inputs inputs(Object value){try{if(value instanceof Map<?,?> wrapper&&wrapper.containsKey("inputs"))value=wrapper.get("inputs");check(value!=null,400,"INVALID_INPUT","inputs");return json.convertValue(value,RunPlanEngine.Inputs.class);}catch(IllegalArgumentException e){throw new Failure(400,"INVALID_INPUT");}}
    private Map<String,Object> draftSnapshot(Map<String,Object> body,RunPlanEngine.Inputs i){
        RunPlanEngine.validateSessionCaps(i);
        check(i!=null&&i.schemaVersion()==1&&Set.of("DISTANCE","RACE").contains(Objects.toString(i.goalKind(),""))&&(i.goalDistanceM()==5000||i.goalDistanceM()==10000),422,"UNSUPPORTED_GOAL","goalDistanceM");
        check(i.title()!=null&&!i.title().isBlank()&&i.title().length()<=120,422,"INVALID_INPUT","title");
        check(i.startDate()!=null&&i.endDate()!=null,422,"DATE_RANGE","startDate","endDate");today(i.timeZone());
        check(Set.of("BEGINNER","INTERMEDIATE","ADVANCED").contains(Objects.toString(i.experience(),""))&&Set.of("DISTANCE","RUN_WALK").contains(Objects.toString(i.trainingMode(),""))&&Set.of("LOWER","STANDARD","HIGHER").contains(Objects.toString(i.volume(),""))&&Set.of("EASY","STANDARD","HIGHER").contains(Objects.toString(i.difficulty(),"")),400,"INVALID_INPUT");
        check(i.availableWeekdays()!=null&&new HashSet<>(i.availableWeekdays()).size()==i.availableWeekdays().size()&&i.availableWeekdays().stream().allMatch(d->d!=null&&d>=1&&d<=7)&&i.runsPerWeek()>=3&&i.runsPerWeek()<=5&&i.longRunWeekday()>=1&&i.longRunWeekday()<=7,400,"INVALID_INPUT","availableWeekdays");
        check(i.baselineWeeklyM()>=0&&i.baselineWeeklyM()<=200000&&i.longestRecentM()>=0&&i.longestRecentM()<=100000&&i.baselineRunsPerWeek()>=0&&i.baselineRunsPerWeek()<=7,400,"INPUT_BOUND","baselineWeeklyM");
        long step=body.containsKey("setupStep")?number(body,"setupStep"):4;check(step>=0&&step<=4,400,"INVALID_INPUT","setupStep");
        return map("inputs",object(i),"setupStep",step);
    }
    private Map<String,Object> object(Object value){return json.convertValue(value,new TypeReference<LinkedHashMap<String,Object>>(){});}
    Object exportValue(Object value){return json.convertValue(value,Object.class);}
    private List<RunPlanEngine.Day> versionDays(PlanVersion v){return v.workoutSnapshot.stream().map(d->json.convertValue(d,RunPlanEngine.Day.class)).toList();}
    private String hash(Object value){try{var node=json.valueToTree(value);return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(canonical(node))));}catch(Exception e){throw new IllegalStateException(e);}}
    private JsonNode canonical(JsonNode n){if(n.isObject()){var o=json.createObjectNode();var keys=new TreeSet<String>();n.fieldNames().forEachRemaining(keys::add);keys.forEach(k->o.set(k,canonical(n.get(k))));return o;}if(n.isArray()){var a=json.createArrayNode();n.forEach(v->a.add(canonical(v)));return a;}return n;}
    private LocalDate today(String zone){try{return LocalDate.now(ZoneId.of(zone));}catch(RuntimeException e){throw new Failure(422,"INVALID_ZONE","timeZone");}}
    private void revision(long actual,long expected){check(actual==expected,409,"STALE_REVISION");}
    private <T> T transaction(Supplier<T> action){
        for(int n=0;;n++)try{return tx.execute(s->action.get());}catch(TransientDataAccessException e){if(n==2)throw new Failure(503,"RETRY_LATER");}
    }
    private Map<String,Object> command(Runner user,String operation,String path,Map<String,Object> b,Supplier<Map<String,Object>> action){
        UUID key=uuid(text(b,"clientKey"));String requestHash=hash(map("path",path,"body",b));
        return transaction(()->{
            runners.findByIdForUpdate(user.getId()).filter(r->!r.isDeleted()).orElseThrow(()->new Failure(401,"SESSION_EXPIRED"));
            var previous=owned(PlanCommand.class,user,"and x.operation=:op and x.clientKey=:key",Map.of("op",operation,"key",key),1);
            if(!previous.isEmpty()) {
                var p=previous.get(0);check(p.requestHash.equals(requestHash),409,"SAVE_KEY_REUSED");
                if(p.result.get("activityId")!=null)check(activities.findByIdAndRunner(Long.valueOf(p.result.get("activityId").toString()),user).isPresent(),410,"RUN_DELETED");
                return p.result;
            }
            Map<String,Object> result=action.get();
            PlanCommand receipt=new PlanCommand();receipt.runner=em.getReference(Runner.class,user.getId());receipt.operation=operation;receipt.clientKey=key;
            receipt.requestHash=requestHash;receipt.result=result;receipt.expiresAt=Instant.now().plus(Duration.ofDays(7));em.persist(receipt);em.flush();return result;
        });
    }
    public Map<String,Object> profile(Runner r){return transaction(()->{
        var evidence=baselineEvidence(r);var found=owned(PlanProfile.class,r,"",Map.of(),1);if(found.isEmpty())return map("profile",null,"baselineEvidence",evidence);
        var p=found.get(0);return map("revision",p.revision,"profile",map("experience",p.ability,"baselineWeeklyM",p.weeklyDistanceM,
            "baselineRunsPerWeek",p.baselineRunsPerWeek,"longestRecentM",p.longestRunM,"canWalk20Minutes",p.canWalk20Minutes,"timeZone",p.timeZone,"units",p.units,
            "recentResult",p.resultDate==null?null:new RunPlanEngine.Result(p.resultDistanceM,p.resultSeconds,p.resultDate)),"baselineEvidence",evidence);
    });}
    private Map<String,Object> baselineEvidence(Runner r){
        ZoneId zone=ActivityLocalDates.zoneOf(r);LocalDate end=LocalDate.now(zone).with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusDays(1),start=end.minusDays(27);
        int[] load=new int[4],count=new int[4];int longest=0,unknown=0;
        for(var a:activities.findByRunnerAndActivityTypeOrderByIdDesc(r,ActivityType.RUN)) {
            var date=activityDate(a,zone);if(date==null||a.isStravaApiSourced()){unknown++;continue;}if(date.isBefore(start)||date.isAfter(end))continue;
            int index=(int)java.time.temporal.ChronoUnit.DAYS.between(start,date)/7;load[index]+=Math.max(0,meters(a));count[index]++;longest=Math.max(longest,meters(a));
        }
        List<Map<String,Object>> weeks=new ArrayList<>();for(int n=0;n<4;n++)weeks.add(map("from",start.plusWeeks(n).toString(),"to",start.plusWeeks(n).plusDays(6).toString(),"recordedRunCount",count[n],"recordedDistanceM",count[n]==0?null:load[n]));
        Map<String,Object> suggestion=null;if(Arrays.stream(count).allMatch(n->n>0)){int[] sorted=load.clone(),counts=count.clone();Arrays.sort(sorted);Arrays.sort(counts);suggestion=map("baselineWeeklyM",((sorted[1]+sorted[2])/2)/50*50,"baselineRunsPerWeek",(counts[1]+counts[2])/2,"longestRecentM",longest);}
        return map("source","ACTIVITY_HISTORY","coverage","UNCONFIRMED","timeZone",zone.getId(),"weeks",weeks,"suggestion",suggestion,"unknownDateCount",unknown);
    }
    public Map<String,Object> saveProfile(Runner r,Map<String,Object> b,String match,String none){return transaction(()->{
        runners.findByIdForUpdate(r.getId()).orElseThrow(()->new Failure(401,"SESSION_EXPIRED"));
        var i=inputs(b);engine.generate(i,today(i.timeZone()),List.of());
        var found=owned(PlanProfile.class,r,"",Map.of(),1);PlanProfile p;
        if(found.isEmpty()){check("*".equals(none),409,"PROFILE_CREATE_CONDITION");p=new PlanProfile();p.runner=em.getReference(Runner.class,r.getId());}
        else{p=found.get(0);check(('"'+Long.toString(p.revision)+'"').equals(match),409,"STALE_REVISION");p.revision++;}
        p.ability=i.experience();p.weeklyDistanceM=i.baselineWeeklyM();p.baselineRunsPerWeek=i.baselineRunsPerWeek();p.longestRunM=i.longestRecentM();
        p.canWalk20Minutes=i.canWalk20Minutes();p.timeZone=i.timeZone();p.units="MI".equals(i.units())?"MI":"KM";
        p.resultDistanceM=i.recentResult()==null?null:i.recentResult().distanceM();p.resultSeconds=i.recentResult()==null?null:i.recentResult().seconds();p.resultDate=i.recentResult()==null?null:i.recentResult().date();
        if(found.isEmpty())em.persist(p);
        return map("revision",p.revision);
    });}
    private Map<String,Object> planDto(RunPlan p){return map("id",p.id.toString(),"title",p.title,"state",p.state,"revision",p.revision,"inputs",object(inputs(p.inputSnapshot)),"setupStep",p.inputSnapshot.getOrDefault("setupStep",4),
        "versions",owned(PlanVersion.class,p.runner,"and x.planId=:id order by x.ordinal desc",Map.of("id",p.id),100).stream().map(v->map("id",v.id.toString(),"state",v.state,"ordinal",v.ordinal)).toList());}
    public Map<String,Object> list(Runner r){return transaction(()->map("ownerId",r.getId().toString(),
        "offlineUntil",r.getTokenIssuedAt()==null?null:Math.min(Instant.now().plus(Duration.ofDays(1)).toEpochMilli(),r.getTokenIssuedAt().plusDays(30).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()),
        "plans",owned(RunPlan.class,r,"and x.state<>'EXTERNAL' order by x.createdAt desc, x.id",Map.of(),100).stream().map(this::planDto).toList(),"rulesApproved",approved,"activationAllowed",approved||experimental,"experimentalActivation",experimental));}
    public Map<String,Object> plan(Runner r,String id){return transaction(()->planDto(row(RunPlan.class,r,uuid(id),false)));}
    public Map<String,Object> create(Runner r,Map<String,Object> b){return command(r,"CREATE_PLAN","plans",b,()->{
        check(owned(RunPlan.class,r,"and x.state='DRAFT'",Map.of(),21).size()<20,422,"DRAFT_LIMIT");
        var i=inputs(b.get("inputs"));var snapshot=draftSnapshot(b,i);RunPlan p=new RunPlan();p.runner=em.getReference(Runner.class,r.getId());
        p.title=i.title();p.goalKind=i.goalKind();p.targetDistanceM=i.goalDistanceM();p.inputSnapshot=snapshot;em.persist(p);
        return map("id",p.id.toString(),"revision",p.revision);
    });}
    public Map<String,Object> edit(Runner r,String id,Map<String,Object> b,String match){return transaction(()->{
        runners.findByIdForUpdate(r.getId()).orElseThrow(()->new Failure(401,"SESSION_EXPIRED"));var p=generated(row(RunPlan.class,r,uuid(id),true));
        check(('"'+Long.toString(p.revision)+'"').equals(match),409,"STALE_REVISION");check(p.state.equals("DRAFT"),409,"PLAN_NOT_DRAFT");
        var i=inputs(b.get("inputs"));p.inputSnapshot=draftSnapshot(b,i);p.title=i.title();p.goalKind=i.goalKind();p.targetDistanceM=i.goalDistanceM();p.revision++;return planDto(p);
    });}
    private RunPlanEngine.Day day(PlanWorkout w){
        List<RunPlanEngine.Step> steps=owned(PlanStep.class,w.runner,"and x.workoutId=:id order by x.sequence",Map.of("id",w.id),32).stream()
            .map(s->new RunPlanEngine.Step(s.sequence,s.stepType,s.distanceM,s.durationS,s.repetitions,s.paceMinSPerKm,s.paceMaxSPerKm,s.effortKey)).toList();
        return new RunPlanEngine.Day(w.id.toString(),w.localDate,w.workoutType,w.phase,w.targetDistanceM,w.targetDurationS,steps,w.state,w.completionSource,w.versionId.toString(),w.revision);
    }
    private List<PlanWorkout> published(Runner r,UUID planId){return owned(PlanWorkout.class,r,"and x.planId=:id and x.state<>'RETIRED' order by x.localDate",Map.of("id",planId),182);}
    private List<RunPlanEngine.Day> retained(RunPlan p,LocalDate date){return published(p.runner,p.id).stream().filter(w->w.localDate.isBefore(date)||!w.state.equals("PLANNED")).map(this::day).toList();}
    public Map<String,Object> generate(Runner r,String id,Map<String,Object> b){
        var replay=transaction(()->owned(PlanCommand.class,r,"and x.operation='GENERATE' and x.clientKey=:key",Map.of("key",uuid(text(b,"clientKey"))),1));
        if(!replay.isEmpty()){check(replay.get(0).requestHash.equals(hash(map("path",id,"body",b))),409,"SAVE_KEY_REUSED");return replay.get(0).result;}
        // Compute outside the write transaction. The basis is rechecked under owner lock before storage.
        UUID planId=uuid(id);var i=inputs(b.get("inputs"));LocalDate date=today(i.timeZone());
        var basis=transaction(()->{var p=generated(row(RunPlan.class,r,planId,false));revision(p.revision,number(b,"baseRevision"));check(!p.state.equals("ARCHIVED"),409,"PLAN_ARCHIVED");
            var a=active(r);return new GenerationBasis(p.revision,a==null?null:a.id,a==null?null:a.revision,retained(p,date));});
        long started=System.nanoTime();var candidate=engine.generate(i,date,basis.retained);
        check(System.nanoTime()-started<2_000_000_000L,503,"GENERATION_TIMEOUT");
        return command(r,"GENERATE",id,b,()->{
            var p=generated(row(RunPlan.class,r,planId,true));revision(p.revision,basis.revision);var a=active(r);
            check(Objects.equals(a==null?null:a.id,basis.activeId)&&Objects.equals(a==null?null:a.revision,basis.activeRevision)&&hash(retained(p,date)).equals(hash(basis.retained))&&date.equals(today(i.timeZone())),409,"STALE_PREVIEW");
            PlanVersion v=new PlanVersion();v.runner=em.getReference(Runner.class,r.getId());v.planId=p.id;v.baseRevision=p.revision;
            v.ordinal=owned(PlanVersion.class,r,"and x.planId=:id",Map.of("id",p.id),1000).size()+1;
            v.inputSnapshot=map("inputs",object(i),"paceReviewAfter",p.inputSnapshot.get("paceReviewAfter"),"paceDismissedHash",p.inputSnapshot.get("paceDismissedHash"),"activePlanId",basis.activeId==null?null:basis.activeId.toString(),"activePlanRevision",basis.activeRevision,
                "replacedWorkoutIds",published(r,p.id).stream().filter(w->!w.localDate.isBefore(date)&&w.state.equals("PLANNED")).map(w->w.id.toString()).toList());
            v.workoutSnapshot=candidate.days().stream().map(d->object(d.id()==null?d.identified(UUID.randomUUID().toString(),v.id.toString()):d)).toList();
            v.generationLocalDate=date;v.timeZone=i.timeZone();v.startDate=i.startDate();v.endDate=i.endDate();v.warnings=candidate.warnings();
            var trainingInputs=object(i);trainingInputs.remove("title");trainingInputs.remove("units");
            v.contentHash=hash(map("inputs",trainingInputs,"date",date,"days",candidate.days(),"warnings",candidate.warnings()));v.inputHash=hash(v.inputSnapshot);v.retainedHash=hash(basis.retained);
            try{check(json.writeValueAsBytes(v.workoutSnapshot).length<1_048_576,422,"OUTPUT_BUDGET");}catch(java.io.IOException e){throw new IllegalStateException(e);}
            em.persist(v);return map("id",v.id.toString(),"planId",p.id.toString());
        });
    }
    private record GenerationBasis(long revision,UUID activeId,Long activeRevision,List<RunPlanEngine.Day> retained){}
    public Map<String,Object> movePreview(Runner r,String id,String wid,Map<String,Object> b){
        return command(r,"MOVE_PREVIEW",id+"/"+wid,b,()->{
            var p=generated(row(RunPlan.class,r,uuid(id),true));check(p.state.equals("ACTIVE"),409,"PLAN_NOT_ACTIVE");revision(p.revision,number(b,"baseRevision"));
            var w=workout(r,id,wid,true);revision(w.revision,number(b,"revision"));
            check(owned(PlanActivityLink.class,r,"and x.workoutId=:id",Map.of("id",w.id),1).isEmpty(),409,"LINKED_WORKOUT");
            var i=inputs(p.inputSnapshot);var date=today(i.timeZone());LocalDate target;
            try{target=LocalDate.parse(text(b,"targetDate"));}catch(java.time.format.DateTimeParseException e){throw new Failure(400,"INVALID_INPUT","targetDate");}
            var existing=published(r,p.id).stream().map(this::day).toList();
            var candidate=engine.move(i,existing,wid,target,date);
            return storeReviewVersion(r,p,i,date,candidate,map("kind","WORKOUT_MOVE","fromDate",w.localDate.toString(),"toDate",target.toString(),"workoutType",w.workoutType));
        });
    }
    private Map<String,Object> storeReviewVersion(Runner r,RunPlan p,RunPlanEngine.Inputs i,LocalDate date,RunPlanEngine.Candidate candidate,Map<String,Object> change) {
        var protectedDays=retained(p,date);PlanVersion v=new PlanVersion();v.runner=em.getReference(Runner.class,r.getId());v.planId=p.id;v.baseRevision=p.revision;
            v.ordinal=owned(PlanVersion.class,r,"and x.planId=:id",Map.of("id",p.id),1000).size()+1;
            v.inputSnapshot=map("inputs",object(i),"paceReviewAfter",p.inputSnapshot.get("paceReviewAfter"),"paceDismissedHash",p.inputSnapshot.get("paceDismissedHash"),"activePlanId",p.id.toString(),"activePlanRevision",p.revision,
                "change",change,
                "replacedWorkoutIds",published(r,p.id).stream().map(this::day).filter(d->!d.localDate().isBefore(date)&&d.state().equals("PLANNED")).map(RunPlanEngine.Day::id).toList());
            v.workoutSnapshot=candidate.days().stream().map(d->object(d.id()==null?d.identified(UUID.randomUUID().toString(),v.id.toString()):d)).toList();
            v.generationLocalDate=date;v.timeZone=i.timeZone();v.startDate=i.startDate();v.endDate=i.endDate();v.warnings=candidate.warnings();
            v.contentHash=hash(map("inputs",object(i),"date",date,"days",candidate.days(),"change",v.inputSnapshot.get("change"),"warnings",v.warnings));
            v.inputHash=hash(v.inputSnapshot);v.retainedHash=hash(protectedDays);em.persist(v);
            return map("id",v.id.toString(),"planId",p.id.toString());
    }
    private boolean stale(RunPlan p,PlanVersion v){var a=active(p.runner);return p.revision!=v.baseRevision || !today(v.timeZone).equals(v.generationLocalDate) ||
        !Objects.equals(a==null?null:a.id.toString(),v.inputSnapshot.get("activePlanId")) ||
        !Objects.equals(a==null?null:a.revision,v.inputSnapshot.get("activePlanRevision")==null?null:((Number)v.inputSnapshot.get("activePlanRevision")).longValue()) || !hash(retained(p,v.generationLocalDate)).equals(v.retainedHash);}
    private record PaceBasis(RunPlanPaceReview.Analysis analysis,String evidenceHash,List<Map<String,Object>> sources,List<Map<String,Object>> excludedSources){}
    private PaceBasis paceBasis(RunPlan p) {
        var i=inputs(p.inputSnapshot);var date=today(i.timeZone());
        if(!p.state.equals("ACTIVE")||i.trainingMode().equals("RUN_WALK"))return new PaceBasis(new RunPlanPaceReview.Analysis("NOT_AVAILABLE",null,100,List.of()),"",List.of(),List.of());
        var days=published(p.runner,p.id);var byId=new HashMap<UUID,PlanWorkout>();days.forEach(w->byId.put(w.id,w));
        var samples=new ArrayList<RunPlanPaceReview.Sample>();var sources=new ArrayList<Map<String,Object>>();var excluded=new ArrayList<Map<String,Object>>();
        var links=owned(PlanActivityLink.class,p.runner,"and x.workoutId in :ids",Map.of("ids",new ArrayList<>(byId.keySet())),182);
        links.sort(Comparator.comparing((PlanActivityLink l)->byId.get(l.workoutId).localDate).reversed());
        for(var link:links) {
            var w=byId.get(link.workoutId);var a=link.activity;
            String reason=null;
            if(p.inputSnapshot.get("paceReviewAfter") instanceof String cutoff&&!w.localDate.isAfter(LocalDate.parse(cutoff)))reason="ALREADY_REVIEWED";
            else if(!Set.of("STEADY","INTERVAL").contains(w.workoutType))reason="NOT_QUALITY";
            else if(!w.state.equals("COMPLETED")||!link.decision.equals("COMPLETE"))reason="INCOMPLETE";
            else if(w.localDate.isAfter(date))reason="FUTURE_DATE";
            else if(w.localDate.isBefore(date.minusDays(42)))reason="TOO_OLD";
            else if(a.isStravaApiSourced()||activityDate(a,ZoneId.of(i.timeZone()))==null)reason="DATE_UNCERTAIN";
            else if(!w.localDate.equals(activityDate(a,ZoneId.of(i.timeZone()))))reason="DATE_MISMATCH";
            else if(!eligible(a))reason="METRICS_UNAVAILABLE";
            else if(w.targetDistanceM==null||Math.abs(meters(a)-w.targetDistanceM)>w.targetDistanceM*0.05)reason="DISTANCE_MISMATCH";
            var d=reason==null?day(w):null;
            if(reason==null&&d.steps().stream().anyMatch(s->s.distanceM()==null||s.paceMinSPerKm()==null||s.paceMaxSPerKm()==null))reason="NO_PACE_REFERENCE";
            double actual=reason==null?seconds(a)*1000d/meters(a):0;
            if(reason==null&&(actual<60||actual>1800))reason="PACE_OUT_OF_RANGE";
            if(reason==null&&samples.size()==5)reason="SAMPLE_LIMIT";
            if(reason!=null){excluded.add(map("activityId",a.getId().toString(),"name",a.getName(),"localDate",w.localDate.toString(),"reason",reason));continue;}
            double planned=d.steps().stream().mapToDouble(s->s.distanceM().doubleValue()*(s.paceMinSPerKm()+s.paceMaxSPerKm())/2d).sum()/w.targetDistanceM;
            samples.add(new RunPlanPaceReview.Sample(w.id.toString(),a.getId().toString(),activityHash(a),actual,planned));
            sources.add(map("activityId",a.getId().toString(),"name",a.getName(),"localDate",w.localDate.toString(),"actualPace",actual,"plannedPace",planned,"provider",a.getProvider()));
        }
        var analysis=RunPlanPaceReview.assess(samples);
        int scale=(int)Math.round(Objects.requireNonNullElse(i.paceScaleBps(),10000)*analysis.percent()/100d);
        if(scale<5000||scale>20000)analysis=new RunPlanPaceReview.Analysis("LIMIT_REACHED",null,100,analysis.samples());
        String evidence=hash(map("samples",samples));
        if(analysis.state().equals("RECOMMENDED")&&evidence.equals(p.inputSnapshot.get("paceDismissedHash")))analysis=new RunPlanPaceReview.Analysis("DECLINED",analysis.direction(),analysis.percent(),analysis.samples());
        return new PaceBasis(analysis,evidence,List.copyOf(sources),List.copyOf(excluded));
    }
    public Map<String,Object> paceReview(Runner r,String id){return transaction(()->{
        var p=row(RunPlan.class,r,uuid(id),false);var basis=paceBasis(p);var a=basis.analysis;
        return map("state",a.state(),"direction",a.direction(),"percent",a.percent(),"sampleCount",a.samples().size(),"sources",basis.sources,"excludedSources",basis.excludedSources,"evidenceHash",basis.evidenceHash,"planRevision",p.revision);
    });}
    public Map<String,Object> paceDecision(Runner r,String id,Map<String,Object> b,boolean accept) {
        return command(r,accept?"PACE_PREVIEW":"PACE_DISMISS",id,b,()->{
            var p=generated(row(RunPlan.class,r,uuid(id),true));check(p.state.equals("ACTIVE"),409,"PLAN_NOT_ACTIVE");revision(p.revision,number(b,"baseRevision"));
            var basis=paceBasis(p);check(basis.analysis.state().equals("RECOMMENDED")&&basis.evidenceHash.equals(text(b,"evidenceHash")),409,"PACE_EVIDENCE_CHANGED");
            var i=inputs(p.inputSnapshot);
            if(!accept){p.inputSnapshot=map("inputs",object(i),"paceDismissedHash",basis.evidenceHash,"paceReviewAfter",p.inputSnapshot.get("paceReviewAfter"));p.revision++;return map("id",id,"state","DECLINED");}
            i=i.withPaceScale((int)Math.round(Objects.requireNonNullElse(i.paceScaleBps(),10000)*basis.analysis.percent()/100d));
            var date=today(i.timeZone());var candidate=RunPlanPaceReview.preview(published(r,p.id).stream().map(this::day).toList(),date,basis.analysis.percent());
            return storeReviewVersion(r,p,i,date,candidate,map("kind","PACE_REVIEW","direction",basis.analysis.direction(),"percent",basis.analysis.percent(),"sampleCount",basis.analysis.samples().size()));
        });
    }
    public Map<String,Object> version(Runner r,String planId,String versionId){return transaction(()->{
        var p=row(RunPlan.class,r,uuid(planId),false);var v=row(PlanVersion.class,r,uuid(versionId),false);check(v.planId.equals(p.id),404,"NOT_FOUND");
        return map("id",v.id.toString(),"planId",p.id.toString(),"title",inputs(v.inputSnapshot.get("inputs")).title(),"state",v.state,"baseRevision",v.baseRevision,
            "contentHash",v.contentHash,"inputs",v.inputSnapshot.get("inputs"),"activePlanId",v.inputSnapshot.get("activePlanId"),"activePlanRevision",v.inputSnapshot.get("activePlanRevision"),
            "weeks",RunPlanEngine.weeks(versionDays(v)),"retainedWorkoutIds",versionDays(v).stream().filter(d->!v.id.toString().equals(d.versionId())).map(RunPlanEngine.Day::id).toList(),"replacedWorkoutIds",v.inputSnapshot.getOrDefault("replacedWorkoutIds",List.of()),
            "change",v.inputSnapshot.get("change"),"warnings",v.warnings,"stale",v.state.equals("READY")&&stale(p,v),"rulesApproved",approved&&v.generatorVersion.equals(RunPlanEngine.RULES),
            "activationAllowed",(approved||experimental)&&v.mode.equals("ORIGINAL")&&v.generatorVersion.equals(RunPlanEngine.RULES),"experimentalActivation",experimental,"rules",v.generatorVersion);
    });}
    public Map<String,Object> activate(Runner r,String id,Map<String,Object> b){return command(r,"ACTIVATE",id,b,()->{
        var p=generated(row(RunPlan.class,r,uuid(id),true));var v=row(PlanVersion.class,r,uuid(text(b,"versionId")),true);check(v.planId.equals(p.id),404,"NOT_FOUND");
        check((approved||experimental) && v.mode.equals("ORIGINAL") && v.generatorVersion.equals(RunPlanEngine.RULES),503,"RULES_REVIEW_REQUIRED");
        check(!experimental||Boolean.TRUE.equals(b.get("acknowledgedExperimental")),422,"EXPERIMENTAL_ACKNOWLEDGEMENT_REQUIRED");
        check(v.state.equals("READY")&&!p.state.equals("ARCHIVED")&&!stale(p,v),409,"STALE_PREVIEW");revision(p.revision,number(b,"baseRevision"));
        Long reviewedActiveRevision=b.get("activePlanRevision")==null?null:number(b,"activePlanRevision");
        check(v.contentHash.equals(b.get("contentHash")) && b.containsKey("activePlanId") && b.containsKey("activePlanRevision") &&
            Objects.equals(v.inputSnapshot.get("activePlanId"),b.get("activePlanId")) && Objects.equals(v.inputSnapshot.get("activePlanRevision")==null?null:((Number)v.inputSnapshot.get("activePlanRevision")).longValue(),reviewedActiveRevision),409,"STALE_PREVIEW");
        check(b.get("acknowledgedWarnings") instanceof List<?> && ((List<?>)b.get("acknowledgedWarnings")).containsAll(v.warnings),422,"ACKNOWLEDGEMENT_REQUIRED");
        var old=active(r);if(old!=null && !old.id.equals(p.id)){em.lock(old,LockModeType.PESSIMISTIC_WRITE);old.state="ARCHIVED";old.revision++;}
        for(var other:owned(PlanVersion.class,r,"and x.state='ACTIVE'",Map.of(),100)){other.state="HISTORICAL";}em.flush();
        Set<UUID> kept=new HashSet<>();
        for(var w:published(r,p.id)){em.lock(w,LockModeType.PESSIMISTIC_WRITE);if(w.localDate.isBefore(v.generationLocalDate)||!w.state.equals("PLANNED"))kept.add(w.id);else{w.state="RETIRED";w.revision++;}}
        em.flush();
        for(var d:versionDays(v))if(!kept.contains(uuid(d.id()))) {
            PlanWorkout w=new PlanWorkout();w.id=uuid(d.id());w.runner=em.getReference(Runner.class,r.getId());w.planId=p.id;w.versionId=v.id;w.localDate=d.localDate();w.workoutType=d.workoutType();w.phase=d.phase();w.targetDistanceM=d.targetDistanceM();w.targetDurationS=d.targetDurationS();em.persist(w);
            for(var step:d.steps()){PlanStep s=new PlanStep();s.runner=w.runner;s.workoutId=w.id;s.sequence=step.sequence();s.stepType=step.stepType();s.distanceM=step.distanceM();s.durationS=step.durationS();s.paceMinSPerKm=step.paceMinSPerKm();s.paceMaxSPerKm=step.paceMaxSPerKm();s.effortKey=step.effortKey();em.persist(s);}
        }
        var i=inputs(v.inputSnapshot.get("inputs"));p.title=i.title();
        Object cutoff=v.inputSnapshot.get("change") instanceof Map<?,?> change&&"PACE_REVIEW".equals(change.get("kind"))?v.generationLocalDate.toString():v.inputSnapshot.get("paceReviewAfter");
        Object dismissed=v.inputSnapshot.get("paceDismissedHash");
        p.inputSnapshot=cutoff==null&&dismissed==null?object(i):map("inputs",object(i),"paceReviewAfter",cutoff,"paceDismissedHash",dismissed);p.targetDistanceM=i.goalDistanceM();p.goalKind=i.goalKind();p.state="ACTIVE";p.revision++;v.state="ACTIVE";
        return map("id",p.id.toString(),"versionId",v.id.toString(),"revision",p.revision,"activationMode",experimental?"EXPERIMENTAL":"QUALIFIED_REVIEW","rules",v.generatorVersion,"acknowledgedExperimental",experimental);
    });}
    public Map<String,Object> archive(Runner r,String id,Map<String,Object> b){return command(r,"ARCHIVE",id,b,()->{var p=generated(row(RunPlan.class,r,uuid(id),true));revision(p.revision,number(b,"revision"));p.state="ARCHIVED";p.revision++;for(var v:owned(PlanVersion.class,r,"and x.planId=:id and x.state='ACTIVE'",Map.of("id",p.id),1))v.state="HISTORICAL";return map("id",id,"revision",p.revision);});}
    public Map<String,Object> calendar(Runner r,String id,LocalDate from,LocalDate to){return transaction(()->{
        var p=row(RunPlan.class,r,uuid(id),false);check(from!=null&&to!=null&&!to.isBefore(from)&&java.time.temporal.ChronoUnit.DAYS.between(from,to)<31,400,"DATE_RANGE");
        var days=published(r,p.id).stream().filter(w->!w.localDate.isBefore(from)&&!w.localDate.isAfter(to)).map(this::day).toList();
        var i=inputs(p.inputSnapshot);long actualM=0,actualS=0;int unknown=0;
        for(var a:activities.findByRunnerAndActivityTypeOrderByIdDesc(r,ActivityType.RUN)){LocalDate date=activityDate(a,ZoneId.of(i.timeZone()));if(date==null||a.isStravaApiSourced()){unknown++;continue;}if(!date.isBefore(from)&&!date.isAfter(to)){actualM+=meters(a);actualS+=seconds(a);}}
        return map("plan",planDto(p),"weeks",RunPlanEngine.weeks(days),"actualDistanceM",actualM,"actualDurationS",actualS,"unknownDateCount",unknown);
    });}
    private PlanWorkout workout(Runner r,String pid,String wid,boolean lock){var p=row(RunPlan.class,r,uuid(pid),lock);var w=row(PlanWorkout.class,r,uuid(wid),lock);check(w.planId.equals(p.id)&&!w.state.equals("RETIRED"),404,"NOT_FOUND");return w;}
    public Map<String,Object> detail(Runner r,String pid,String wid){return transaction(()->{var w=workout(r,pid,wid,false);var links=owned(PlanActivityLink.class,r,"and x.workoutId=:id",Map.of("id",w.id),1);return map("workout",day(w),"plan",planDto(row(RunPlan.class,r,w.planId,false)),"link",links.isEmpty()?null:map("activityId",links.get(0).activity.getId().toString(),"decision",links.get(0).decision));});}
    public Map<String,Object> today(Runner r){return transaction(()->{
        var p=active(r);if(p==null)return map("state","NO_PLAN");var i=inputs(p.inputSnapshot);LocalDate date=today(i.timeZone());
        var days=published(r,p.id);String state=date.isBefore(i.startDate())?"UPCOMING":date.isAfter(i.endDate())?"FINISHED_PLAN":"TODAY";
        return map("state",state,"plan",planDto(p),"localDate",date,"workout",days.stream().filter(w->w.localDate.equals(date)).findFirst().map(this::day).orElse(null));
    });}
    static int meters(Activity a){return a.getDistanceMeters()!=null?(int)Math.round(a.getDistanceMeters()):(int)Math.round(a.getDistanceKm()*1000);}
    static int seconds(Activity a){return a.getDurationSeconds()!=null?Math.toIntExact(Math.min(Integer.MAX_VALUE,a.getDurationSeconds())):a.getMovingTimeSeconds();}
    static LocalDate activityDate(Activity a,ZoneId zone){return a.getStartTime()==null?null:a.isStravaApiSourced()?a.getStartTime().toLocalDate():a.getStartTime().toInstant(ZoneOffset.UTC).atZone(zone).toLocalDate();}
    private List<String> linkWarnings(Activity a,PlanWorkout w,ZoneId zone){List<String> warnings=new ArrayList<>();LocalDate d=activityDate(a,zone);if(a.isStravaApiSourced())warnings.add("SOURCE_LOCAL_DATE");if(d==null)warnings.add("UNKNOWN_ACTIVITY_DATE");else if(!d.equals(w.localDate))warnings.add("DIFFERENT_DAY");return warnings;}
    private boolean eligible(Activity a){return a.getActivityType()==ActivityType.RUN && meters(a)>0 && seconds(a)>0 && (a.isStravaApiSourced()||a.getStartTime()==null||!a.getStartTime().toInstant(ZoneOffset.UTC).isAfter(Instant.now()));}
    private String activityHash(Activity a){return hash(map("id",a.getId().toString(),"m",meters(a),"s",seconds(a),"start",a.getStartTime(),"local",a.isStravaApiSourced()));}
    public Map<String,Object> candidates(Runner r,String pid,String wid,LocalDate from,LocalDate to,String cursor){return transaction(()->{
        var w=workout(r,pid,wid,false);check(!w.workoutType.equals("REST"),422,"REST_WORKOUT");var p=row(RunPlan.class,r,w.planId,false);ZoneId zone=ZoneId.of(inputs(p.inputSnapshot).timeZone());
        check(from!=null&&to!=null&&!to.isBefore(from)&&java.time.temporal.ChronoUnit.DAYS.between(from,to)<=366,400,"DATE_RANGE");
        long before=cursor==null?Long.MAX_VALUE:Long.parseLong(cursor);var page=em.createQuery("select a from Activity a where a.runner.id=:owner and a.id<:before and a.activityType=:type order by a.id desc",Activity.class).setParameter("owner",r.getId()).setParameter("before",before).setParameter("type",ActivityType.RUN).setMaxResults(101).getResultList();
        List<Map<String,Object>> out=new ArrayList<>();for(var a:page.subList(0,Math.min(100,page.size()))) {
            var date=activityDate(a,zone);if(!eligible(a)||(date!=null&&(date.isBefore(from)||date.isAfter(to)))||!owned(PlanActivityLink.class,r,"and x.activity.id=:id",Map.of("id",a.getId()),1).isEmpty())continue;
            out.add(map("id",a.getId().toString(),"name",a.getName(),"distanceM",meters(a),"durationS",seconds(a),"localDate",date,"dateConfidence",date==null?"UNKNOWN":a.isStravaApiSourced()?"SOURCE_LOCAL":"PLAN_LOCAL","provider",a.getProvider(),"metricHash",activityHash(a),"warnings",linkWarnings(a,w,zone)));
        }
        return map("activities",out,"nextCursor",page.size()>100?page.get(99).getId().toString():null);
    });}
    public Map<String,Object> link(Runner r,String pid,String wid,Map<String,Object> b){return command(r,"LINK",pid+"/"+wid,b,()->{
        var w=workout(r,pid,wid,true);var p=generated(row(RunPlan.class,r,w.planId,true));check(p.state.equals("ACTIVE"),409,"PLAN_NOT_ACTIVE");revision(w.revision,number(b,"revision"));
        check(!w.workoutType.equals("REST"),422,"REST_WORKOUT");long aid;try{aid=Long.parseLong(text(b,"activityId"));}catch(NumberFormatException e){throw new Failure(400,"INVALID_ID");}
        var a=activities.findByIdAndRunnerForUpdate(aid,r).orElseThrow(()->new Failure(404,"NOT_FOUND"));
        check(eligible(a),422,"ACTIVITY_INELIGIBLE");check(activityHash(a).equals(b.get("metricHash")),409,"ACTIVITY_CHANGED");
        var warnings=linkWarnings(a,w,ZoneId.of(inputs(p.inputSnapshot).timeZone()));check(b.get("acknowledgedWarnings") instanceof List<?> && ((List<?>)b.get("acknowledgedWarnings")).containsAll(warnings),422,"ACKNOWLEDGEMENT_REQUIRED");
        check(owned(PlanActivityLink.class,r,"and (x.workoutId=:w or x.activity.id=:a)",Map.of("w",w.id,"a",aid),1).isEmpty(),409,"ALREADY_LINKED");
        String decision=text(b,"decision");check(Set.of("PARTIAL","COMPLETE").contains(decision),400,"INVALID_INPUT","decision");
        PlanActivityLink link=new PlanActivityLink();link.runner=em.getReference(Runner.class,r.getId());link.activity=a;link.workoutId=w.id;link.decision=decision;em.persist(link);
        w.state=decision.equals("COMPLETE")?"COMPLETED":"PARTIAL";w.completionSource="ACTIVITY";w.revision++;p.revision++;
        return map("workoutId",wid,"planId",pid,"activityId",a.getId().toString(),"revision",w.revision);
    });}
    public Map<String,Object> unlink(Runner r,String pid,String wid,Map<String,Object> b){return command(r,"UNLINK",pid+"/"+wid,b,()->{
        var w=workout(r,pid,wid,true);var p=generated(row(RunPlan.class,r,w.planId,true));revision(w.revision,number(b,"revision"));for(var l:owned(PlanActivityLink.class,r,"and x.workoutId=:id",Map.of("id",w.id),1))em.remove(l);
        w.state="PLANNED";w.completionSource="NONE";w.revision++;p.revision++;return map("workoutId",wid,"revision",w.revision);
    });}
    public Map<String,Object> status(Runner r,String pid,String wid,Map<String,Object> b){return command(r,"SET_STATUS",pid+"/"+wid,b,()->{
        var w=workout(r,pid,wid,true);var p=generated(row(RunPlan.class,r,w.planId,true));check(p.state.equals("ACTIVE"),409,"PLAN_NOT_ACTIVE");revision(w.revision,number(b,"revision"));
        check(!w.workoutType.equals("REST")&&owned(PlanActivityLink.class,r,"and x.workoutId=:id",Map.of("id",w.id),1).isEmpty(),409,"LINKED_WORKOUT");
        String state=text(b,"state");check(Set.of("PLANNED","SKIPPED","COMPLETED").contains(state),400,"INVALID_INPUT","state");w.state=state;w.completionSource=state.equals("COMPLETED")?"UNLOGGED":"NONE";w.revision++;p.revision++;return map("workoutId",wid,"revision",w.revision);
    });}
    public Map<String,Object> backlink(Runner r,long aid){return transaction(()->{
        activities.findByIdAndRunner(aid,r).orElseThrow(()->new Failure(404,"NOT_FOUND"));var found=owned(PlanActivityLink.class,r,"and x.activity.id=:id",Map.of("id",aid),1);if(found.isEmpty())return map("link",null);
        var w=row(PlanWorkout.class,r,found.get(0).workoutId,false);return map("link",map("planId",w.planId.toString(),"workoutId",w.id.toString(),"localDate",w.localDate,"state",w.state));
    });}
}
