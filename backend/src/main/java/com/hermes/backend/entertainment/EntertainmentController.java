package com.hermes.backend.entertainment;

import com.hermes.backend.auth.AuthService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/entertainment")
public class EntertainmentController {
    private final AuthService auth;
    private final EntertainmentService service;
    public EntertainmentController(AuthService auth,EntertainmentService service) { this.auth=auth; this.service=service; }
    private Long owner(String header) {
        return auth.findByAuthorizationHeader(header).filter(r->!r.isDeleted()).map(r->r.getId())
            .orElseThrow(()->new EntertainmentProblem(401,"SIGN_IN_REQUIRED","Sign in required."));
    }
    @GetMapping("/{resource:me|metadata|companion|memories|missions|groups}")
    public Object read(@RequestHeader(value="Authorization",required=false) String authHeader,@PathVariable String resource) {
        return service.read(owner(authHeader),resource,null);
    }
    @GetMapping("/{resource:memories|groups|requests}/{id}")
    public Object item(@RequestHeader(value="Authorization",required=false) String authHeader,@PathVariable String resource,@PathVariable String id) {
        return service.read(owner(authHeader),resource,id);
    }
    @PutMapping(value="/companion",consumes="application/json")
    public Object companion(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"companion.save",null,null,b);
    }
    @PostMapping(value="/memories",consumes="application/json")
    public Object memoryCreate(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"memory.create",null,null,b);
    }
    @PutMapping(value="/memories/{id}",consumes="application/json")
    public Object memoryUpdate(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"memory.update",id,null,b);
    }
    @DeleteMapping(value="/memories/{id}",consumes="application/json")
    public Object memoryDelete(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"memory.delete",id,null,b);
    }
    @PostMapping(value="/missions/{id}",consumes="application/json")
    public Object mission(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"mission.action",id,null,b);
    }
    @PostMapping(value="/groups",consumes="application/json")
    public Object groupCreate(@RequestHeader(value="Authorization",required=false) String h,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"group.create",null,null,b);
    }
    @PutMapping(value="/groups/{id}/slots/{index}",consumes="application/json")
    public Object slot(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@PathVariable Integer index,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"group.slot",id,index,b);
    }
    @PostMapping(value="/groups/{id}/invites",consumes="application/json")
    public Object invite(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"group.invite",id,null,b);
    }
    @PostMapping(value="/invites/{action:accept|decline}",consumes="application/json")
    public Object redeem(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String action,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"invite."+action,null,null,b);
    }
    @PostMapping(value="/groups/{id}/invites/{inviteId}/revoke",consumes="application/json")
    public Object revoke(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@PathVariable String inviteId,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"group.revoke",id+"/"+inviteId,null,b);
    }
    @PostMapping(value="/groups/{id}/leave",consumes="application/json")
    public Object leave(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"group.leave",id,null,b);
    }
    @DeleteMapping(value="/groups/{id}",consumes="application/json")
    public Object groupDelete(@RequestHeader(value="Authorization",required=false) String h,@PathVariable String id,@RequestBody Map<String,Object> b) {
        return service.mutate(owner(h),"group.delete",id,null,b);
    }
    @ExceptionHandler(EntertainmentProblem.class)
    public ResponseEntity<?> problem(EntertainmentProblem error) {
        return ResponseEntity.status(error.status).body(Map.of("code",error.code,"message",error.getMessage()));
    }
}
