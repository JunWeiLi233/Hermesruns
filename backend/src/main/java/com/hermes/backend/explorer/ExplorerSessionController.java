package com.hermes.backend.explorer;

import com.hermes.backend.auth.*;
import com.hermes.backend.infrastructure.mail.TransactionalMailSender;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static com.hermes.backend.explorer.ExplorerJson.*;

@RestController
@RequestMapping("/api/explorer/session")
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerSessionController {
    private final LoginController login;
    private final AuthService auth;
    private final ExplorerSecurity cookies;
    private final ExplorerStore store;
    private final TransactionalMailSender mail;
    @org.springframework.beans.factory.annotation.Value("${recaptcha.site-key:}") private String captchaSiteKey;
    @org.springframework.beans.factory.annotation.Value("${recaptcha.secret-key:}") private String captchaSecretKey;
    public ExplorerSessionController(LoginController login,AuthService auth,ExplorerSecurity cookies,ExplorerStore store,TransactionalMailSender mail) {
        this.login=login;this.auth=auth;this.cookies=cookies;this.store=store;this.mail=mail;
    }
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String,Object> body,HttpServletRequest request) {
        if(!Set.of("email","password","persistent").containsAll(body.keySet()) || (body.containsKey("persistent")&&!(body.get("persistent") instanceof Boolean))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid login.");
        var result=login.login(map("email",body.get("email"),"password",body.get("password")),request);
        if(!result.getStatusCode().is2xxSuccessful()) return result;
        if(!(result.getBody() instanceof Map<?,?> data) || !(data.get("token") instanceof String token)) return ResponseEntity.status(403).body(map("message","Use the Hermes administrator sign-in flow."));
        Runner runner=auth.findByAuthorizationHeader("Bearer "+token).orElseThrow();
        store.owner(runner); // A deleting account cannot receive a new Explorer credential.
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE,cookies.issue(token,Boolean.TRUE.equals(body.get("persistent"))))
                .body(map("opened",true,"csrf",ExplorerSecurity.csrf(token)));
    }
    @GetMapping
    public Map<String,Object> session(HttpServletRequest request) {
        String token=ExplorerSecurity.credential(request);
        Optional<Runner> runner=token==null?Optional.empty():auth.findByAuthorizationHeader("Bearer "+token);
        if(runner.isEmpty()) return map("opened",false,"preferences",Map.of("zone","UTC","language","en","theme","system"));
        var owner=store.owner(runner.get());
        return map("opened",true,"csrf",ExplorerSecurity.csrf(token),"preferences",owner.preferences(),"filter",owner.filter(),"revision",owner.revision());
    }
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        String token=ExplorerSecurity.credential(request);
        if(token!=null) auth.findByAuthorizationHeader("Bearer "+token).ifPresent(auth::invalidateSession);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE,cookies.clear()).body(map("opened",false));
    }
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String,Object> body,HttpServletRequest request) {
        configuredMail();return login.signup(body,request);
    }
    @PostMapping("/resend-verification")
    public ResponseEntity<?> resend(@RequestBody Map<String,Object> body,HttpServletRequest request) {configuredMail();return login.resendVerification(body,request);}
    @PostMapping("/password-reset/request")
    public ResponseEntity<?> recovery(@RequestBody Map<String,Object> body,HttpServletRequest request) {configuredMail();return login.requestPasswordReset(body,request);}
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> reset(@RequestBody Map<String,Object> body,HttpServletRequest request) {return login.confirmPasswordReset(body,request);}
    @GetMapping("/password-rules") public Map<String,Object> rules(){return login.passwordRules();}
    @GetMapping("/configuration") public Map<String,Object> configuration(){return map("recaptchaRequired",captchaSecretKey!=null&&!captchaSecretKey.isBlank(),"recaptchaSiteKey",captchaSiteKey==null?"":captchaSiteKey.trim(),"mailConfigured",mail.isConfigured());}
    private void configuredMail(){if(!mail.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Account email delivery is not configured.");}
}
