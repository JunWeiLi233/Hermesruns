package com.hermes.backend.explorer;

import com.hermes.backend.auth.ApiRateLimiter;
import com.hermes.backend.infrastructure.web.RequestIpResolver;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static com.hermes.backend.explorer.ExplorerJson.*;

@RestController
@RequestMapping("/api/explorer")
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerController {
    private final ExplorerStore store;private final ExplorerQueries queries;private final ExplorerImports imports;private final ExplorerJobs jobs;
    private final ExplorerMail mail;private final ExplorerDeletion deletion;private final ExplorerSecurity cookies;private final ApiRateLimiter rates;
    public ExplorerController(ExplorerStore store,ExplorerQueries queries,ExplorerImports imports,ExplorerJobs jobs,ExplorerMail mail,ExplorerDeletion deletion,ExplorerSecurity cookies,ApiRateLimiter rates){this.store=store;this.queries=queries;this.imports=imports;this.jobs=jobs;this.mail=mail;this.deletion=deletion;this.cookies=cookies;this.rates=rates;}
    @GetMapping("/preferences") public Map<String,Object> preferences(@AuthenticationPrincipal Runner runner){var owner=store.owner(runner);return map("preferences",owner.preferences(),"filter",owner.filter(),"revision",owner.revision());}
    @PatchMapping("/preferences") public Map<String,Object> preferences(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> values,@RequestHeader(value="If-Match",required=false) Long revision){return store.preferences(runner,values,revision);}
    @PutMapping("/filter") public Map<String,Object> filter(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> values,@RequestHeader(value="If-Match",required=false) Long revision){return store.filter(runner,values,revision);}
    @GetMapping("/activities") public Map<String,Object> activities(@AuthenticationPrincipal Runner runner,@RequestParam(defaultValue="startTime") String sort,@RequestParam(defaultValue="true") boolean descending,@RequestParam(defaultValue="0") int cursor,@RequestParam(defaultValue="100") int limit,@RequestParam(required=false) Long revision){return queries.activities(runner,null,sort,descending,cursor,limit,revision);}
    @PostMapping("/activities/query") public Map<String,Object> activityQuery(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> filter,@RequestParam(defaultValue="startTime") String sort,@RequestParam(defaultValue="true") boolean descending,@RequestParam(defaultValue="0") int cursor,@RequestParam(defaultValue="100") int limit,@RequestParam(required=false) Long revision){return queries.activities(runner,filter,sort,descending,cursor,limit,revision);}
    @GetMapping("/activities/{id}") public Map<String,Object> activity(@AuthenticationPrincipal Runner runner,@PathVariable long id,@RequestParam(required=false) Long revision){return queries.activity(runner,id,revision);}
    @GetMapping("/activities/{id}/track") public Map<String,Object> track(@AuthenticationPrincipal Runner runner,@PathVariable long id,@RequestParam(defaultValue="20000") int maxPoints,@RequestParam(required=false) Long revision){return queries.track(runner,id,maxPoints,revision);}
    @GetMapping("/map/summary") public Map<String,Object> summary(@AuthenticationPrincipal Runner runner,@RequestParam(required=false) Long revision){return queries.summary(runner,null,revision);}
    @PostMapping("/map/query") public Map<String,Object> overlay(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> bounds,@RequestParam(required=false) Long revision){return queries.overlay(runner,bounds,revision);}
    @GetMapping("/statistics/{section}") public Map<String,Object> statistics(@AuthenticationPrincipal Runner runner,@PathVariable String section,@RequestParam(required=false) Long revision){return queries.statistics(runner,section,null,revision);}
    @GetMapping("/filter-options") public Map<String,Object> options(@AuthenticationPrincipal Runner runner){return queries.options(runner);}
    @PostMapping(value="/imports",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ResponseEntity<?> importFiles(@AuthenticationPrincipal Runner runner,@RequestPart List<MultipartFile> files,@RequestParam boolean attested,@RequestHeader("Idempotency-Key") String key) throws IOException{return ResponseEntity.accepted().body(imports.enqueue(runner,files,attested,key));}
    @GetMapping("/jobs") public Map<String,Object> jobs(@AuthenticationPrincipal Runner runner){return jobs.list(runner);}
    @GetMapping("/jobs/{id}") public Map<String,Object> job(@AuthenticationPrincipal Runner runner,@PathVariable UUID id){return jobs.get(runner,id);}
    @PostMapping("/jobs/{id}/cancel") public Map<String,Object> cancel(@AuthenticationPrincipal Runner runner,@PathVariable UUID id){return jobs.cancel(runner,id);}
    @GetMapping("/connections") public Map<String,Object> connections(){return map("items",List.of(),"capabilities",map("provider",false,"email",mail.configured(),"imports",List.of("FIT","GPX","TCX"),"storage","private-postgresql"));}
    @PostMapping("/email-preferences/verification") public Map<String,Object> verify(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> body){return mail.requestVerification(runner,body);}
    @PatchMapping("/email-preferences") public Map<String,Object> email(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> body){return mail.preference(runner,body);}
    @PostMapping("/account/deletion") public ResponseEntity<?> delete(@AuthenticationPrincipal Runner runner,@RequestBody Map<String,Object> body){return ResponseEntity.accepted().header(HttpHeaders.SET_COOKIE,cookies.clear()).body(deletion.request(runner,body));}
    @PostMapping("/public/deletion-receipt") public Map<String,Object> receipt(@RequestBody Map<String,Object> body,HttpServletRequest request){limit(request);return deletion.receipt(token(body));}
    @PostMapping("/public/verify-report-email") public Map<String,Object> confirm(@RequestBody Map<String,Object> body,HttpServletRequest request){limit(request);return mail.confirm(token(body));}
    @PostMapping("/public/unsubscribe") public Map<String,Object> unsubscribe(@RequestBody Map<String,Object> body,HttpServletRequest request){limit(request);return mail.unsubscribe(token(body));}
    private String token(Map<String,Object> body){if(body==null||!body.keySet().equals(Set.of("token"))||!(body.get("token") instanceof String value))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid capability.");return value;}
    private void limit(HttpServletRequest request){if(!rates.allow("explorer-public:"+RequestIpResolver.clientIp(request),60,60))throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);}
}
