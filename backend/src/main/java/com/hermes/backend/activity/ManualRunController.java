package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.auth.ApiRateLimiter;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/manual-runs")
public class ManualRunController {
    private final AuthService auth;private final ManualRunService runs;private final ApiRateLimiter limiter;
    public ManualRunController(AuthService auth,ManualRunService runs,ApiRateLimiter limiter){this.auth=auth;this.runs=runs;this.limiter=limiter;}
    @PostMapping
    public ResponseEntity<?> save(@RequestHeader(value="Authorization",required=false) String header,@RequestBody ManualRunService.Request request){
        var owner=auth.findByAuthorizationHeader(header);
        if(owner.isEmpty())return ResponseEntity.status(401).body(Map.of("code","SESSION_EXPIRED"));
        if(auth.isAdmin(owner.get()))return ResponseEntity.status(403).body(Map.of("code","RUNNER_ACCOUNT_REQUIRED"));
        if(!limiter.allow("manual-run:"+owner.get().getId(),60,60))return ResponseEntity.status(429).body(Map.of("code","RATE_LIMITED"));
        try{var result=runs.save(owner.get().getId(),request);return ResponseEntity.status(result.replayed()?200:201).body(result);}
        catch(ManualRunService.Conflict conflict){return ResponseEntity.status(conflict.status).body(Map.of("code",conflict.code));}
        catch(IllegalArgumentException invalid){return ResponseEntity.badRequest().body(Map.of("code","INVALID_RUN","error",invalid.getMessage()));}
    }
}
