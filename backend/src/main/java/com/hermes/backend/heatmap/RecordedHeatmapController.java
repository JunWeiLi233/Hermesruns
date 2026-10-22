package com.hermes.backend.heatmap;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@RestController
@RequestMapping("/api/profile/heatmap")
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class RecordedHeatmapController {
    private final AuthService auth;private final RecordedHeatmapService service;
    public RecordedHeatmapController(AuthService auth,RecordedHeatmapService service){this.auth=auth;this.service=service;}
    @ModelAttribute public void noStore(jakarta.servlet.http.HttpServletResponse response){response.setHeader("Cache-Control","private, no-store");}
    private Runner owner(String header){var runner=auth.findByAuthorizationHeader(header).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));service.ensureOwner(runner);return runner;}
    @PostMapping("/query") public Map<String,Object> query(@RequestHeader(value="Authorization",required=false)String header,@RequestBody Map<String,Object> query){return service.query(owner(header),query);}
    @PostMapping("/workouts/query") public Map<String,Object> workouts(@RequestHeader(value="Authorization",required=false)String header,@RequestBody Map<String,Object> query){return service.workouts(owner(header),query);}
    @GetMapping("/workouts/{id}/track") public Map<String,Object> track(@RequestHeader(value="Authorization",required=false)String header,@PathVariable long id,@RequestParam(required=false)String snapshot,@RequestParam(required=false)String cursor,@RequestParam(defaultValue="20")int zoom){return service.track(owner(header),id,snapshot,cursor,zoom);}
    @GetMapping("/workouts/{id}/tiles") public Map<String,Object> tiles(@RequestHeader(value="Authorization",required=false)String header,@PathVariable long id,@RequestParam(required=false)String snapshot,@RequestParam(required=false)String cursor){return service.tiles(owner(header),id,snapshot,cursor);}
    @GetMapping("/preferences") public Map<String,Object> preferences(@RequestHeader(value="Authorization",required=false)String header){return service.preferences(owner(header));}
    @PatchMapping("/preferences") public Map<String,Object> preferences(@RequestHeader(value="Authorization",required=false)String header,@RequestHeader("If-Match")long revision,@RequestBody Map<String,Object> patch){return service.preferences(owner(header),patch,revision);}
    @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException error){return ResponseEntity.badRequest().body(Map.of("code","INVALID_MAP_QUERY","message",Objects.toString(error.getMessage(),"Invalid map query")));}
}
