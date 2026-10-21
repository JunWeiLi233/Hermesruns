package com.hermes.backend.explorer;

import com.hermes.backend.runner.Runner;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

@Service
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
@Transactional(isolation=Isolation.REPEATABLE_READ)
public class ExplorerQueries {
    private final ExplorerStore store;
    private static final String FROM=" FROM statshunters.activity_facts f JOIN public.activities a ON a.id=f.legacy_activity_id AND a.runner_id=f.runner_id WHERE f.user_id=:user AND f.runner_id=:runner AND NOT a.strava_api_sourced";
    private static final String TOTALS="""
        SELECT count(*) AS count,CASE WHEN count(*)=0 THEN 0 ELSE sum(f.distance_m)/1000 END AS "distanceKm",
        CASE WHEN count(*)=0 THEN 0 ELSE sum(f.moving_seconds) END AS "movingSeconds",
        CASE WHEN count(*)=0 THEN 0 ELSE sum(f.ascent_m) END AS "ascentM",
        count(*) FILTER(WHERE f.point_count>0) AS gps,
        count(*) FILTER(WHERE f.distance_m IS NULL) AS "missingDistance",
        count(*) FILTER(WHERE f.moving_seconds IS NULL) AS "missingTime"
        """;
    record Selection(ExplorerStore.Owner owner,Map<String,Object> args,String where) {}
    public ExplorerQueries(ExplorerStore store){this.store=store;}
    private Selection select(Runner runner,Map<String,Object> requested,Long revision) {
        var owner=store.owner(runner);store.revision(owner,revision);
        Map<String,Object> args=map("user",owner.id(),"runner",owner.runnerId());
        String where=new ExplorerFilter(requested==null?owner.filter():requested).sql((String)owner.preferences().get("zone"),args);
        return new Selection(owner,args,where);
    }
    public Map<String,Object> activities(Runner runner,Map<String,Object> filter,String sort,boolean descending,int cursor,int limit,Long revision) {
        var s=select(runner,filter,revision);
        Map<String,String> sorts=Map.of("startTime","f.start_at","name","lower(f.name)","distanceKm","f.distance_m","movingSeconds","f.moving_seconds","ascentM","f.ascent_m");
        if(!sorts.containsKey(sort)||cursor<0||cursor>1000000||limit<1||limit>1000) throw new ResponseStatusException(BAD_REQUEST,"Invalid history page.");
        long total=count(s),history=store.named().queryForObject("SELECT count(*)"+FROM,s.args,Long.class);
        s.args.put("limit",limit);s.args.put("offset",cursor);
        var items=store.named().query("SELECT f.*"+FROM+s.where+" ORDER BY "+sorts.get(sort)+(descending?" DESC":" ASC")+" NULLS LAST,f.legacy_activity_id ASC LIMIT :limit OFFSET :offset",s.args,this::activity);
        return map("items",items,"total",total,"nextCursor",cursor+items.size()<total?cursor+items.size():null,"historyCount",history,"revision",s.owner.revision());
    }
    private long count(Selection s){return store.named().queryForObject("SELECT count(*)"+FROM+s.where,s.args,Long.class);}
    public Map<String,Object> activity(Runner runner,long id,Long revision) {
        var s=select(runner,ExplorerFilter.EMPTY,revision);s.args.put("activity",id);
        var found=store.named().query("SELECT f.*"+FROM+" AND f.legacy_activity_id=:activity",s.args,this::activity);
        if(found.isEmpty())throw new ResponseStatusException(NOT_FOUND,"Activity unavailable.");
        return map("activity",found.get(0),"revision",s.owner.revision());
    }
    private Map<String,Object> activity(ResultSet row,int index) throws SQLException {
        var data=object(row.getString("metadata"));
        data.putAll(map("id",row.getLong("legacy_activity_id"),"name",row.getString("name"),"startTime",row.getTimestamp("start_at").toInstant().toString(),"sport",row.getString("sport"),"subtype",row.getString("subtype"),
                "commute",row.getObject("commute"),"trainer",row.getObject("trainer"),"gear",row.getString("gear"),"distanceKm",row.getObject("distance_m")==null?null:row.getDouble("distance_m")/1000,
                "movingSeconds",row.getObject("moving_seconds"),"elapsedSeconds",row.getObject("elapsed_seconds"),"ascentM",row.getObject("ascent_m"),"pointCount",row.getInt("point_count"),"segments",List.of(),"cells",List.of()));
        return data;
    }
    @SuppressWarnings("unchecked")
    public Map<String,Object> track(Runner runner,long id,int maxPoints,Long revision) {
        return displayTrack(runner,id,maxPoints,revision,true);
    }
    @SuppressWarnings("unchecked")
    private Map<String,Object> displayTrack(Runner runner,long id,int maxPoints,Long revision,boolean includeCells) {
        if(maxPoints<100||maxPoints>20000)throw new ResponseStatusException(BAD_REQUEST,"Invalid display point limit.");
        var s=select(runner,ExplorerFilter.EMPTY,revision);s.args.put("activity",id);
        var found=store.named().queryForList("SELECT f.id,f.metadata,t.segments::text"+FROM.replace(" WHERE "," JOIN statshunters.track_segments t ON t.activity_id=f.id AND t.user_id=f.user_id WHERE ")+" AND f.legacy_activity_id=:activity",s.args);
        if(found.isEmpty())throw new ResponseStatusException(NOT_FOUND,"Track unavailable.");
        var row=found.get(0);var segments=(List<List<Map<String,Object>>>)read((String)row.get("segments"));
        int total=segments.stream().mapToInt(List::size).sum();boolean sampled=total>maxPoints;
        List<List<Map<String,Object>>> display=new ArrayList<>();
        // Budget across every source segment; one-point segments remain visible. Refuse a response
        // whose segment count alone exceeds the budget instead of silently losing entire segments.
        if(segments.size()*2>maxPoints) throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"This track has too many segments for a bounded display.");
        int remaining=maxPoints-segments.size()*2;
        for(var segment:segments) {
            int allowance=Math.min(segment.size(),2+(int)Math.floor(remaining*(segment.size()/(double)Math.max(total,1))));
            if(!sampled||segment.size()<=allowance){display.add(segment);continue;}
            List<Map<String,Object>> points=new ArrayList<>();
            for(int i=0;i<allowance;i++) points.add(segment.get((int)Math.round(i*(segment.size()-1d)/(allowance-1))));
            display.add(points);
        }
        var cells=includeCells?store.jdbc().query("SELECT x,y FROM statshunters.activity_tiles WHERE user_id=? AND activity_id=? ORDER BY x,y LIMIT 5001",(rs,n)->rs.getInt(1)+":"+rs.getInt(2),s.owner.id(),row.get("id")):List.<String>of();
        var quality=(Map<String,Object>)object(row.get("metadata").toString()).get("quality");quality.put("displaySampled",sampled);quality.put("retainedPointCount",total);
        quality.put("cellsDisplayLimited",cells.size()>5000);if(cells.size()>5000)cells=cells.subList(0,5000);
        return map("segments",display,"cells",cells,"quality",quality,"revision",s.owner.revision());
    }
    public Map<String,Object> summary(Runner runner,Map<String,Object> filter,Long revision) {
        var s=select(runner,filter,revision);var totals=totals(s,"");
        long cells=store.named().queryForObject("SELECT count(DISTINCT (t.x,t.y))"+FROM.replace(" WHERE "," JOIN statshunters.activity_tiles t ON t.activity_id=f.id AND t.user_id=f.user_id WHERE ")+s.where,s.args,Long.class);
        var bounds=store.named().queryForMap("SELECT min((f.metadata->'bounds'->>'south')::float8) AS south,max((f.metadata->'bounds'->>'north')::float8) AS north,min((f.metadata->'bounds'->>'west')::float8) AS west,max((f.metadata->'bounds'->>'east')::float8) AS east"+FROM+s.where,s.args);
        totals.put("bounds",bounds.get("south")==null?null:bounds);
        totals.put("cells",cells);totals.put("revision",s.owner.revision());return totals;
    }
    private Map<String,Object> totals(Selection s,String extra){return store.named().queryForMap(TOTALS+FROM+s.where+extra,s.args);}
    public Map<String,Object> statistics(Runner runner,String section,Map<String,Object> filter,Long revision) {
        if(!Set.of("all","totals","records","monthly","yearly","weekly","cumulative","rolling","toDate").contains(section))throw new ResponseStatusException(BAD_REQUEST,"Unknown statistics section.");
        var s=select(runner,filter,revision);String zone=(String)s.owner.preferences().get("zone");s.args.put("zone",zone);
        Map<String,Object> result=map("totals",totals(s,""));
        Map<String,Object> records=new LinkedHashMap<>();
        for(var entry:Map.of("distance","distance_m","time","moving_seconds","ascent","ascent_m").entrySet()) {
            var rows=store.named().query("SELECT f.*"+FROM+s.where+" AND f."+entry.getValue()+" IS NOT NULL ORDER BY f."+entry.getValue()+" DESC,f.legacy_activity_id LIMIT 1",s.args,this::activity);
            records.put(entry.getKey(),rows.isEmpty()?null:rows.get(0));
        }
        result.put("records",records);
        for(String period:List.of("month","year","week")) {
            String format=period.equals("year")?"YYYY":period.equals("month")?"YYYY-MM":"YYYY-MM-DD";
            var series=store.named().queryForList(TOTALS+",to_char(date_trunc('"+period+"',f.start_at AT TIME ZONE :zone),'"+format+"') AS period"+FROM+s.where+" GROUP BY period ORDER BY period",s.args);
            result.put(period.equals("month")?"monthly":period.equals("year")?"yearly":"weekly",series);
        }
        @SuppressWarnings("unchecked") var monthly=(List<Map<String,Object>>)result.get("monthly");
        double running=0;boolean known=false;List<Map<String,Object>> cumulative=new ArrayList<>();
        for(var row:monthly){var copy=new LinkedHashMap<>(row);if(row.get("distanceKm") instanceof Number n){running+=n.doubleValue();known=true;}copy.put("distanceKm",known?running:null);cumulative.add(copy);}result.put("cumulative",cumulative);
        LocalDate today=LocalDate.now(ZoneId.of(zone));List<Map<String,Object>> rolling=new ArrayList<>(),toDate=new ArrayList<>();
        s.args.put("through",java.sql.Timestamp.from(today.plusDays(1).atStartOfDay(ZoneId.of(zone)).toInstant()));
        for(int days:new int[]{7,30,90,365}) {s.args.put("since",java.sql.Timestamp.from(today.minusDays(days-1).atStartOfDay(ZoneId.of(zone)).toInstant()));var row=totals(s," AND f.start_at>=:since AND f.start_at<:through");row.put("period",days+" days");rolling.add(row);}
        for(var entry:Map.of("Month to date",today.withDayOfMonth(1),"Year to date",today.withDayOfYear(1)).entrySet()) {s.args.put("since",java.sql.Timestamp.from(entry.getValue().atStartOfDay(ZoneId.of(zone)).toInstant()));var row=totals(s," AND f.start_at>=:since AND f.start_at<:through");row.put("period",entry.getKey());toDate.add(row);}
        result.put("rolling",rolling);result.put("toDate",toDate);
        return map("section",section,"data",section.equals("all")?result:result.get(section),"revision",s.owner.revision());
    }
    public Map<String,Object> options(Runner runner) {
        var s=select(runner,null,null);
        return map("gear",store.named().queryForList("SELECT DISTINCT f.gear"+FROM+" AND f.gear IS NOT NULL ORDER BY f.gear",s.args,String.class),
                "sports",store.named().queryForList("SELECT DISTINCT f.sport"+FROM+" ORDER BY f.sport",s.args,String.class),"revision",s.owner.revision());
    }
    public Map<String,Object> overlay(Runner runner,Map<String,Object> input,Long revision) {
        if(!input.keySet().equals(Set.of("west","south","east","north"))) throw new ResponseStatusException(BAD_REQUEST,"Invalid map bounds.");
        for(Object value:input.values()) if(!(value instanceof Number n)||!Double.isFinite(n.doubleValue()))throw new ResponseStatusException(BAD_REQUEST,"Invalid map bounds.");
        double west=((Number)input.get("west")).doubleValue(),east=((Number)input.get("east")).doubleValue(),south=((Number)input.get("south")).doubleValue(),north=((Number)input.get("north")).doubleValue();
        if(west< -180||east>180||west>east||south< -85.05112878||north>85.05112878||south>north)throw new ResponseStatusException(BAD_REQUEST,"Unsupported map bounds.");
        var s=select(runner,null,revision);
        s.args.put("x0",(int)Math.floor((west+180)/360*16384));s.args.put("x1",Math.min(16383,(int)Math.floor((east+180)/360*16384)));
        s.args.put("y0",tileY(north));s.args.put("y1",tileY(south));
        String from=FROM.replace(" WHERE "," JOIN statshunters.activity_tiles t ON t.activity_id=f.id AND t.user_id=f.user_id WHERE ")+s.where+" AND t.x BETWEEN :x0 AND :x1 AND t.y BETWEEN :y0 AND :y1";
        var cells=store.named().queryForList("SELECT t.x,t.y,count(*) AS visits"+from+" GROUP BY t.x,t.y ORDER BY t.x,t.y LIMIT 5001",s.args);
        boolean limited=cells.size()>5000;if(limited)cells=cells.subList(0,5000);
        var ids=store.named().queryForList("SELECT DISTINCT f.legacy_activity_id"+from+" ORDER BY f.legacy_activity_id LIMIT 51",s.args,Long.class);
        boolean tracksLimited=ids.size()>50;if(tracksLimited)ids=ids.subList(0,50);
        List<Map<String,Object>> tracks=new ArrayList<>();for(long id:ids){var track=displayTrack(runner,id,1000,s.owner.revision(),false);track.put("id",id);tracks.add(track);}
        return map("cells",cells,"tracks",tracks,"limited",limited||tracksLimited,"revision",s.owner.revision());
    }
    private int tileY(double lat){return Math.max(0,Math.min(16383,(int)Math.floor((1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2*16384)));}
}
