package com.hermes.backend.explorer;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.ZoneId;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

@Service
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerStore {
    final JdbcTemplate jdbc;
    final NamedParameterJdbcTemplate named;
    private final RunnerRepository runners;
    record Owner(UUID id,long runnerId,long revision,String state,Map<String,Object> preferences,Map<String,Object> filter) {}
    public ExplorerStore(JdbcTemplate jdbc,RunnerRepository runners) {
        this.jdbc=jdbc;this.named=new NamedParameterJdbcTemplate(jdbc);this.runners=runners;
    }
    JdbcTemplate jdbc() {return jdbc;}
    NamedParameterJdbcTemplate named() {return named;}
    @Transactional
    Owner owner(Runner runner) {
        if(runner==null || runner.isDeleted()) throw new ResponseStatusException(UNAUTHORIZED,"Sign in to continue.");
        // Read the canonical row inside this transaction: a principal captured at request start
        // may predate a profile change in Hermes's other UI. That change must invalidate all panels.
        var calendar=jdbc.queryForList("SELECT time_zone FROM public.runner WHERE id=? AND deleted=false",runner.getId());
        if(calendar.isEmpty())throw new ResponseStatusException(UNAUTHORIZED,"Sign in to continue.");
        String zone=Objects.toString(calendar.get(0).get("time_zone"),"UTC");
        try {ZoneId.of(zone);}catch(RuntimeException invalid){zone="UTC";}
        jdbc.update("INSERT INTO statshunters.account_profiles(id,runner_id,preferences) VALUES(?,?,?::jsonb) ON CONFLICT(runner_id) DO NOTHING",UUID.randomUUID(),runner.getId(),write(map("zone",zone)));
        var owner=loadOwner(runner.getId());
        if(!owner.state.equals("active")) throw new ResponseStatusException(GONE,"Account deletion is in progress.");
        if(!zone.equals(owner.preferences.get("zone"))) {
            jdbc.update("UPDATE statshunters.account_profiles SET preferences=jsonb_set(preferences,'{zone}',to_jsonb(?::text),true),dataset_revision=dataset_revision+1 WHERE id=? AND runner_id=? AND preferences->>'zone' IS DISTINCT FROM ?",zone,owner.id,owner.runnerId,zone);
            owner=loadOwner(runner.getId());
        }
        Map<String,Object> defaults=map("units","km","zone",zone,"theme","system","currency","USD",
                "metric","distance","annualGoalKm","","hideFromClubs",true,"language","en","reportEmail","","reportsEnabled",false);
        defaults.putAll(owner.preferences);
        defaults.put("zone",zone);
        var emails=jdbc.queryForList("SELECT address,verified_at,enabled FROM statshunters.email_preferences WHERE user_id=?",owner.id);
        if(!emails.isEmpty()) {var mail=emails.get(0);defaults.put("reportEmail",mail.get("address")==null?"":mail.get("address"));defaults.put("reportsEnabled",mail.get("enabled"));defaults.put("reportEmailVerified",mail.get("verified_at")!=null);}
        return new Owner(owner.id,owner.runnerId,owner.revision,owner.state,defaults,new ExplorerFilter(owner.filter).values);
    }
    private Owner loadOwner(Long runnerId) {
        return jdbc.queryForObject("SELECT * FROM statshunters.account_profiles WHERE runner_id=?",(rs,n)->new Owner(
                rs.getObject("id",UUID.class),runnerId,rs.getLong("dataset_revision"),rs.getString("state"),object(rs.getString("preferences")),object(rs.getString("filter_spec"))),runnerId);
    }
    Owner lock(Runner runner) {
        Runner locked=runners.findByIdForUpdate(runner.getId()).filter(r->!r.isDeleted()).orElseThrow(()->new ResponseStatusException(UNAUTHORIZED));
        Owner owner=owner(locked);
        jdbc.queryForObject("SELECT dataset_revision FROM statshunters.account_profiles WHERE id=? AND runner_id=? FOR UPDATE",Long.class,owner.id,owner.runnerId);
        return owner;
    }
    void bump(Owner owner) { jdbc.update("UPDATE statshunters.account_profiles SET dataset_revision=dataset_revision+1 WHERE id=? AND runner_id=? AND state='active'",owner.id,owner.runnerId); }
    void revision(Owner owner,Long expected) {if(expected!=null && owner.revision!=expected) throw new ResponseStatusException(CONFLICT,"The dataset changed. Reload the selection.");}
    @Transactional
    public Map<String,Object> preferences(Runner runner,Map<String,Object> patch,Long expected) {
        Owner owner=lock(runner);revision(owner,expected);
        Set<String> allowed=Set.of("units","zone","theme","currency","metric","annualGoalKm","hideFromClubs","language","map");
        if(patch==null||!allowed.containsAll(patch.keySet())) throw new ResponseStatusException(BAD_REQUEST,"Unknown preference.");
        Map<String,Object> prefs=new LinkedHashMap<>(owner.preferences);prefs.putAll(patch);
        if(prefs.get("map") instanceof Map<?,?> previous){
            @SuppressWarnings("unchecked") var value=(Map<String,Object>)previous;
            @SuppressWarnings("unchecked") var old=owner.preferences.get("map") instanceof Map<?,?> m?(Map<String,Object>)m:Map.<String,Object>of();
            prefs.put("map",com.hermes.backend.heatmap.RecordedMapPreferences.merge(old,patch.containsKey("map")?value:Map.of()));
        } else if(prefs.containsKey("map"))throw new ResponseStatusException(BAD_REQUEST,"Invalid map settings.");
        choices(prefs,"units",Set.of("km","mi"));choices(prefs,"theme",Set.of("light","dark","system"));choices(prefs,"metric",Set.of("distance","moving","ascent"));choices(prefs,"language",Set.of("en","zh-CN"));
        try { ZoneId.of((String)prefs.get("zone"));java.util.Currency.getInstance((String)prefs.get("currency")); }
        catch(RuntimeException e) {throw new ResponseStatusException(BAD_REQUEST,"Invalid calendar zone or currency.");}
        if(!(prefs.get("hideFromClubs") instanceof Boolean)) throw new ResponseStatusException(BAD_REQUEST,"Invalid privacy choice.");
        Object goal=prefs.get("annualGoalKm");
        if(!"".equals(goal) && (!(goal instanceof Number n)||!Double.isFinite(n.doubleValue())||n.doubleValue()<0||n.doubleValue()>1e7)) throw new ResponseStatusException(BAD_REQUEST,"Invalid annual goal.");
        Runner current=runners.findById(owner.runnerId).orElseThrow();current.setTimeZone((String)prefs.get("zone"));runners.saveAndFlush(current);
        prefs.keySet().retainAll(allowed);
        jdbc.update("UPDATE statshunters.account_profiles SET preferences=?::jsonb,dataset_revision=dataset_revision+1 WHERE id=? AND runner_id=?",write(prefs),owner.id,owner.runnerId);
        return owner(current).preferences;
    }
    private void choices(Map<String,Object> prefs,String key,Set<String> values) {if(!(prefs.get(key) instanceof String v)||!values.contains(v)) throw new ResponseStatusException(BAD_REQUEST,"Invalid preference.");}
    @Transactional
    public Map<String,Object> filter(Runner runner,Map<String,Object> values,Long expected) {
        Owner owner=lock(runner);revision(owner,expected);ExplorerFilter filter=new ExplorerFilter(values);
        jdbc.update("UPDATE statshunters.account_profiles SET filter_spec=?::jsonb,dataset_revision=dataset_revision+1 WHERE id=? AND runner_id=?",write(filter.values),owner.id,owner.runnerId);
        return map("filter",filter.values,"revision",owner.revision+1);
    }
}
