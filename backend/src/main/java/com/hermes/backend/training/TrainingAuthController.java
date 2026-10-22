package com.hermes.backend.training;

import com.hermes.backend.auth.*;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import java.time.Duration;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.map;

@RestController
@RequestMapping("/api/training/auth")
@ConditionalOnProperty(name="app.training-workspace.enabled",havingValue="true")
public class TrainingAuthController {
    final LoginController login;final AuthService auth;final TrainingStore db;final boolean secure;final EmailVerificationService mail;
    public TrainingAuthController(LoginController login,AuthService auth,TrainingStore db,boolean secure){this(login,auth,db,secure,null);}
    @org.springframework.beans.factory.annotation.Autowired
    public TrainingAuthController(LoginController login,AuthService auth,TrainingStore db,@Value("${app.training-workspace.cookie-secure:true}")boolean secure,EmailVerificationService mail){this.login=login;this.auth=auth;this.db=db;this.secure=secure;this.mail=mail;}
    @GetMapping("/csrf") public Map<String,Object> csrf(CsrfToken token){return map("token",token.getToken(),"headerName",token.getHeaderName());}
    @PostMapping("/session") public Map<String,Object> existingSession(HttpServletRequest request,HttpServletResponse response){
        // Reuse the already verified Hermes credential; never issue or expose another session token.
        String credential=request.getHeader(HttpHeaders.AUTHORIZATION);
        TrainingFailure.check(credential!=null&&credential.startsWith("Bearer "),401,"SIGN_IN_REQUIRED");
        Runner runner=auth.findByAuthorizationHeader(credential).orElseThrow(()->new TrainingFailure(401,"SESSION_EXPIRED"));
        response.addHeader(HttpHeaders.SET_COOKIE,cookie(credential.substring(7),Duration.ofDays(30)).toString());
        return db.profile(db.ensure(runner.getId(),runner.getDisplayName(),runner.getTimeZone()));
    }
    @PostMapping("/login") public ResponseEntity<?> login(@RequestBody Map<String,Object> body,HttpServletRequest request,HttpServletResponse response){
        // Keep verification, throttling, password checks and admin MFA in their existing authority.
        var result=login.login(body,request);
        if(result.getStatusCode().is2xxSuccessful()&&result.getBody() instanceof Map<?,?> value&&value.get("token") instanceof String token){
            Runner runner=auth.findByAuthorizationHeader("Bearer "+token).orElseThrow(()->new TrainingFailure(401,"SESSION_EXPIRED"));
            result.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE).forEach(cookieHeader->response.addHeader(HttpHeaders.SET_COOKIE,cookieHeader));
            response.addHeader(HttpHeaders.SET_COOKIE,cookie(token,Duration.ofDays(30)).toString());
            String id=db.ensure(runner.getId(),runner.getDisplayName(),runner.getTimeZone());return ResponseEntity.ok(map("user",db.profile(id)));
        }
        return result;
    }
    @PostMapping("/signup") public ResponseEntity<?> signup(@RequestBody Map<String,Object> body,HttpServletRequest request){TrainingFailure.check(mail!=null&&mail.isMailConfigured(),503,"VERIFIED_MAIL_REQUIRED_FOR_SIGNUP");return login.signup(body,request);}
    @PostMapping("/logout") public Map<String,Object> logout(HttpServletRequest request,HttpServletResponse response){
        String credential=TrainingCookieFilter.credential(request);if(credential!=null)auth.findByAuthorizationHeader(credential).ifPresent(auth::invalidateSession);
        response.addHeader(HttpHeaders.SET_COOKIE,cookie("",Duration.ZERO).toString());return map("signedOutEverywhere",true);
    }
    ResponseCookie cookie(String token,Duration age){return ResponseCookie.from("hermes_training",token).httpOnly(true).secure(secure).sameSite("Strict").path("/api/training").maxAge(age).build();}
}
