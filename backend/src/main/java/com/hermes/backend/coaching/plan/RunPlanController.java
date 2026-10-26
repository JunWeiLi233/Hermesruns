package com.hermes.backend.coaching.plan;

import com.hermes.backend.auth.*;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import static com.hermes.backend.coaching.plan.RunPlanService.*;

@RestController
@RequestMapping("/api")
public class RunPlanController {
    private final AuthService auth;private final RunPlanService plans;private final ApiRateLimiter limiter;
    public RunPlanController(AuthService auth,RunPlanService plans,ApiRateLimiter limiter){this.auth=auth;this.plans=plans;this.limiter=limiter;}
    private Runner owner(String h){var r=auth.findByAuthorizationHeader(h).orElseThrow(()->new Failure(401,"SESSION_EXPIRED"));check(!auth.isAdmin(r),403,"RUNNER_ACCOUNT_REQUIRED");return r;}
    private ResponseEntity<?> call(String h,String operation,Map<String,Object> b,java.util.function.Function<Runner,Object> action){
        try{Runner r=owner(h);if(b!=null){check(b.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length<=65536,400,"REQUEST_TOO_LARGE");check(limiter.allow("run-plan:"+operation+":"+r.getId(),operation.equals("generate")?5:60,60),429,"RATE_LIMITED");}
            return ResponseEntity.ok(action.apply(r));
        }catch(Failure f){return ResponseEntity.status(f.status).header("Cache-Control","no-store").header("Retry-After",f.status==429?"60":"0").body(map("code",f.code,"fieldErrors",f.fields,"requestId",UUID.randomUUID().toString(),"suggestedChanges",f.fields));}
        catch(RunPlanEngine.Invalid f){return ResponseEntity.unprocessableContent().body(map("code",f.code,"fieldErrors",f.fields,"suggestedChanges",f.fields,"requestId",UUID.randomUUID().toString()));}
        catch(IllegalArgumentException f){return ResponseEntity.badRequest().body(map("code","INVALID_INPUT","requestId",UUID.randomUUID().toString()));}
    }
    @GetMapping("/plan-profile") ResponseEntity<?> profile(@RequestHeader(value="Authorization",required=false)String h){var result=call(h,"read",null,plans::profile);if(result.getBody() instanceof Map<?,?> m&&m.get("revision")!=null)return ResponseEntity.status(result.getStatusCode()).eTag(m.get("revision").toString()).body(result.getBody());return result;}
    @PutMapping("/plan-profile") ResponseEntity<?> profile(@RequestHeader(value="Authorization",required=false)String h,@RequestHeader(value="If-Match",required=false)String match,@RequestHeader(value="If-None-Match",required=false)String none,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.saveProfile(r,b,match,none));}
    @GetMapping("/run-plans") ResponseEntity<?> list(@RequestHeader(value="Authorization",required=false)String h){return call(h,"read",null,plans::list);}
    @PostMapping("/run-plans") ResponseEntity<?> create(@RequestHeader(value="Authorization",required=false)String h,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.create(r,b));}
    @GetMapping("/run-plans/today") ResponseEntity<?> today(@RequestHeader(value="Authorization",required=false)String h){return call(h,"read",null,plans::today);}
    @GetMapping("/run-plans/{id}") ResponseEntity<?> plan(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id){var result=call(h,"read",null,r->plans.plan(r,id));if(result.getBody() instanceof Map<?,?>m&&m.get("revision")!=null)return ResponseEntity.status(result.getStatusCode()).eTag(m.get("revision").toString()).body(result.getBody());return result;}
    @PatchMapping("/run-plans/{id}") ResponseEntity<?> edit(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestHeader(value="If-Match",required=false)String match,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.edit(r,id,b,match));}
    @PostMapping("/run-plans/{id}/versions") ResponseEntity<?> generate(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestBody Map<String,Object>b){return call(h,"generate",b,r->plans.generate(r,id,b));}
    @GetMapping("/run-plans/{id}/versions/{vid}") ResponseEntity<?> version(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String vid){return call(h,"read",null,r->plans.version(r,id,vid));}
    @PostMapping("/run-plans/{id}/activate") ResponseEntity<?> activate(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.activate(r,id,b));}
    @PostMapping("/run-plans/{id}/archive") ResponseEntity<?> archive(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.archive(r,id,b));}
    @GetMapping("/run-plans/{id}/workouts") ResponseEntity<?> calendar(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestParam LocalDate from,@RequestParam LocalDate to){return call(h,"read",null,r->plans.calendar(r,id,from,to));}
    @GetMapping("/run-plans/{id}/workouts/{wid}") ResponseEntity<?> detail(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String wid){return call(h,"read",null,r->plans.detail(r,id,wid));}
    @GetMapping("/run-plans/{id}/workouts/{wid}/activity-candidates") ResponseEntity<?> candidates(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String wid,@RequestParam LocalDate from,@RequestParam LocalDate to,@RequestParam(required=false)String cursor){return call(h,"read",null,r->plans.candidates(r,id,wid,from,to,cursor));}
    @PostMapping("/run-plans/{id}/workouts/{wid}/link") ResponseEntity<?> link(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String wid,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.link(r,id,wid,b));}
    @PostMapping("/run-plans/{id}/workouts/{wid}/unlink") ResponseEntity<?> unlink(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String wid,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.unlink(r,id,wid,b));}
    @PostMapping("/run-plans/{id}/workouts/{wid}/status") ResponseEntity<?> status(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String wid,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.status(r,id,wid,b));}
    @GetMapping("/run-plans/activity-links/{aid}") ResponseEntity<?> backlink(@RequestHeader(value="Authorization",required=false)String h,@PathVariable Long aid){return call(h,"read",null,r->plans.backlink(r,aid));}
    @PostMapping("/run-plans/{id}/workouts/{wid}/move-preview") ResponseEntity<?> move(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@PathVariable String wid,@RequestBody Map<String,Object>b){return call(h,"generate",b,r->plans.movePreview(r,id,wid,b));}
    @GetMapping("/run-plans/{id}/pace-review") ResponseEntity<?> pace(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id){return call(h,"read",null,r->plans.paceReview(r,id));}
    @PostMapping("/run-plans/{id}/pace-preview") ResponseEntity<?> pacePreview(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestBody Map<String,Object>b){return call(h,"generate",b,r->plans.paceDecision(r,id,b,true));}
    @PostMapping("/run-plans/{id}/pace-dismiss") ResponseEntity<?> paceDismiss(@RequestHeader(value="Authorization",required=false)String h,@PathVariable String id,@RequestBody Map<String,Object>b){return call(h,"write",b,r->plans.paceDecision(r,id,b,false));}
}
