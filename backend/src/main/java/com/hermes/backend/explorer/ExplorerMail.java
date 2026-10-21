package com.hermes.backend.explorer;

import com.hermes.backend.auth.*;
import com.hermes.backend.infrastructure.mail.*;
import com.hermes.backend.runner.Runner;
import java.net.URI;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

@Service
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerMail {
    private final ExplorerStore store;
    private final TransactionalMailSender sender;
    private final SecretEncryptionService encryption;
    private final ApiRateLimiter rates;
    private final String publicUrl;
    public ExplorerMail(ExplorerStore store,TransactionalMailSender sender,SecretEncryptionService encryption,ApiRateLimiter rates,
            @Value("${app.explorer.public-url:http://localhost:8080/heatmap/}") String publicUrl) {
        this.store=store;this.sender=sender;this.encryption=encryption;this.rates=rates;this.publicUrl=publicUrl.split("#",2)[0];
        URI uri=URI.create(this.publicUrl);
        if(!"https".equals(uri.getScheme())&&!ExplorerSecurity.isLoopback(this.publicUrl)) throw new IllegalStateException("Explorer email links require an HTTPS public URL.");
    }
    public boolean configured(){return sender.isConfigured()&&encryption.isConfigured();}
    @Transactional
    public Map<String,Object> requestVerification(Runner runner,Map<String,Object> body) {
        if(!configured()) throw new ResponseStatusException(SERVICE_UNAVAILABLE,"Report email delivery is not configured.");
        if(!Set.of("email").equals(body.keySet()) || !(body.get("email") instanceof String address) || address.length()>254||!PasswordStrengthChecker.looksLikeEmail(address)||address.chars().anyMatch(Character::isISOControl)) throw new ResponseStatusException(BAD_REQUEST,"Enter a valid report address.");
        var owner=store.lock(runner);
        if(!rates.allow("explorer-verify:"+owner.runnerId(),5,3600)) throw new ResponseStatusException(TOO_MANY_REQUESTS,"Try email verification later.");
        String token=secret(),unsubscribe=secret(),email=address.trim().toLowerCase(Locale.ROOT);
        store.jdbc().update("""
            INSERT INTO statshunters.email_preferences(user_id,address,verification_hash,verification_expires_at,unsubscribe_hash,unsubscribe_secret)
            VALUES(?,?,?,now()+interval '24 hours',?,?) ON CONFLICT(user_id) DO UPDATE SET address=excluded.address,verification_hash=excluded.verification_hash,
            verification_expires_at=excluded.verification_expires_at,unsubscribe_hash=excluded.unsubscribe_hash,unsubscribe_secret=excluded.unsubscribe_secret,verified_at=NULL,enabled=false
            """,owner.id(),email,hash(token),hash(unsubscribe),encryption.encrypt(unsubscribe));
        UUID job=UUID.randomUUID();
        store.jdbc().update("INSERT INTO statshunters.background_jobs(id,user_id,kind,dedupe_key,request_hash,input) VALUES(?,?,'report_verification',?,?,?::jsonb)",job,owner.id(),"verify-"+job,hash(token),write(map("secret",encryption.encrypt(write(map("email",email,"token",token,"unsubscribe",unsubscribe))))));
        store.bump(owner);return map("accepted",true,"verified",false);
    }
    @Transactional
    public Map<String,Object> confirm(String token) {
        validateToken(token);
        int changed=store.jdbc().update("WITH verified AS (UPDATE statshunters.email_preferences e SET verified_at=now(),verification_hash=NULL,verification_expires_at=NULL WHERE verification_hash=? AND verification_expires_at>now() AND EXISTS(SELECT 1 FROM statshunters.account_profiles p WHERE p.id=e.user_id AND p.state='active') RETURNING user_id) UPDATE statshunters.account_profiles SET dataset_revision=dataset_revision+1 WHERE id IN(SELECT user_id FROM verified)",hash(token));
        if(changed!=1) throw new ResponseStatusException(BAD_REQUEST,"Verification link is invalid or expired.");
        return map("verified",true);
    }
    @Transactional
    public Map<String,Object> preference(Runner runner,Map<String,Object> body) {
        if(!body.keySet().equals(Set.of("enabled"))||!(body.get("enabled") instanceof Boolean enabled)) throw new ResponseStatusException(BAD_REQUEST,"Invalid report preference.");
        var owner=store.lock(runner);
        int changed=store.jdbc().update("UPDATE statshunters.email_preferences SET enabled=? WHERE user_id=? AND verified_at IS NOT NULL",enabled,owner.id());
        if(changed!=1) throw new ResponseStatusException(CONFLICT,"Verify a report address first.");store.bump(owner);
        return map("enabled",enabled);
    }
    @Transactional
    public Map<String,Object> unsubscribe(String token) {
        validateToken(token);
        // Same minimal response for a previously used, unknown or already removed capability.
        store.jdbc().update("WITH opted_out AS (UPDATE statshunters.email_preferences SET enabled=false WHERE unsubscribe_hash=? RETURNING user_id) UPDATE statshunters.account_profiles SET dataset_revision=dataset_revision+1 WHERE id IN(SELECT user_id FROM opted_out)",hash(token));
        return map("unsubscribed",true);
    }
    private void validateToken(String token){if(token==null||!token.matches("[a-f0-9]{64}")) throw new ResponseStatusException(BAD_REQUEST,"Invalid email link.");}
    void process(UUID user,UUID job,UUID lease) {
        var input=object(store.jdbc().queryForObject("SELECT input::text FROM statshunters.background_jobs WHERE id=? AND user_id=? AND lease_owner=?",String.class,job,user,lease));
        var values=object(encryption.decrypt((String)input.get("secret")));
        String token=(String)values.get("token"),email=(String)values.get("email");
        int pending=store.jdbc().queryForObject("SELECT count(*) FROM statshunters.email_preferences WHERE user_id=? AND verification_hash=? AND verification_expires_at>now()",Integer.class,user,hash(token));
        if(pending==0)return;
        String prefix=publicUrl.endsWith("/")?publicUrl:publicUrl+"/";
        // The main application uses normal URLs. Keep the standalone hash-router
        // entry compatible only when an operator explicitly selects /explorer/.
        if(prefix.endsWith("/explorer/")) prefix+="#/";
        String link=prefix+"verify-report-email?token="+token,unsubscribe=prefix+"unsubscribe?token="+values.get("unsubscribe");
        String text="Confirm this address for your Hermes Explorer reports:\n"+link+"\n\nThe link expires in 24 hours. Report delivery stays off until you enable it in account settings.\nOpt out: "+unsubscribe;
        sender.send(new TransactionalMailMessage(email,"Verify your Explorer report address",text,null,"explorer-report-verify-"+job));
    }
}
