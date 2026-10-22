package com.hermes.backend.explorer;

import com.hermes.backend.runner.Runner;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/** Capability probe in the normal Hermes bearer-authenticated API, including H2 hosts. */
@RestController
public class ExplorerAvailabilityController {
    private final ObjectProvider<ExplorerStore> modules;
    public ExplorerAvailabilityController(ObjectProvider<ExplorerStore> modules) {this.modules=modules;}

    @GetMapping("/api/profile/heatmap/explorer")
    public Map<String,Object> available(@AuthenticationPrincipal Runner runner) {
        if(runner==null || runner.isDeleted()) throw new ResponseStatusException(UNAUTHORIZED);
        var store=modules.getIfAvailable();
        if(store==null) return Map.of("available",false);
        var ready=store.jdbc().queryForObject("SELECT count(*) FROM information_schema.tables WHERE table_schema='statshunters' AND table_name IN ('account_profiles','background_jobs','file_assets','activity_facts','track_segments','activity_tiles','email_preferences','deletion_requests')",Integer.class);
        return Map.of("available",ready!=null && ready==8);
    }
}
