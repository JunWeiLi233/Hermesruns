package com.hermes.backend.heatmap;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.runner.Runner;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.function.BiConsumer;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Owner-scoped read adapter over the existing canonical history. No provider calls. */
@Service
public class RecordedHeatmapService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final int VERTICES=12000, PARTS=500, GEOMETRY_BYTES=400*1024;
    private static final List<String> METRICS=List.of("minDistanceKm","maxDistanceKm","minMinutes","maxMinutes","minAscentM","maxAscentM","minSpeedKmh","maxSpeedKmh","minHeartRate","maxHeartRate");
    private final JdbcTemplate jdbc;
    private final byte[] cursorKey=new byte[32];
    private final Map<String,Dataset> cache=new LinkedHashMap<>(8,.75f,true);
    private final Map<String,TileDataset> tileCache=new LinkedHashMap<>(4,.75f,true);
    record Owner(long runner,long revision,String zone,Map<String,Object> preferences) {}
    record Line(long activity,int index,List<double[]> points,int sourceCount,boolean sourceSegments) {}
    record Dataset(long builtAt,List<Map<String,Object>> workouts,List<Line> lines) {}
    record TileDataset(long builtAt,Map<Long,RecordedWorkoutTiles.Counts> counts,Map<Long,Map<String,Object>> provenance) {}
    public RecordedHeatmapService(JdbcTemplate jdbc){this.jdbc=jdbc;new SecureRandom().nextBytes(cursorKey);}
    static Map<String,Object> map(Object...pairs){var value=new LinkedHashMap<String,Object>();for(int i=0;i<pairs.length;i+=2)value.put(pairs[i].toString(),pairs[i+1]);return value;}
    static String json(Object value){try{return JSON.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException("Invalid map data");}}
    static Map<String,Object> object(String value){try{return JSON.readValue(value,new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new IllegalArgumentException("Invalid map preferences");}}
    @Transactional public void ensureOwner(Runner runner) {
        if(runner==null||runner.isDeleted())throw new ResponseStatusException(UNAUTHORIZED);
        jdbc.update("INSERT INTO statshunters.account_profiles(id,runner_id) VALUES(?,?) ON CONFLICT(runner_id) DO NOTHING",UUID.randomUUID(),runner.getId());
    }
    private Owner owner(Runner runner) {
        var rows=jdbc.queryForList("SELECT p.dataset_revision,p.preferences::text,p.state,r.time_zone FROM statshunters.account_profiles p JOIN public.runner r ON r.id=p.runner_id WHERE p.runner_id=? AND r.deleted=false",runner.getId());
        if(rows.isEmpty()||!"active".equals(rows.get(0).get("state")))throw new ResponseStatusException(NOT_FOUND,"Account unavailable");
        var row=rows.get(0);String zone=Objects.toString(row.get("time_zone"),"UTC");try{ZoneId.of(zone);}catch(Exception e){zone="UTC";}
        return new Owner(runner.getId(),((Number)row.get("dataset_revision")).longValue(),zone,object(row.get("preferences").toString()));
    }
    @Transactional(readOnly=true) public Map<String,Object> preferences(Runner runner) {
        var owner=owner(runner);Object previous=owner.preferences.get("map");
        @SuppressWarnings("unchecked") var existing=previous instanceof Map<?,?>?(Map<String,Object>)previous:Map.<String,Object>of();
        return map("preferences",RecordedMapPreferences.merge(existing,Map.of()),"revision",owner.revision,"snapshot",snapshot(owner));
    }
    @Transactional public Map<String,Object> preferences(Runner runner,Map<String,Object> patch,long revision) {
        jdbc.queryForObject("SELECT id FROM statshunters.account_profiles WHERE runner_id=? FOR UPDATE",UUID.class,runner.getId());
        var owner=owner(runner);if(revision!=owner.revision)throw new ResponseStatusException(CONFLICT,"Map settings changed. Reload before saving.");
        @SuppressWarnings("unchecked") var existing=owner.preferences.get("map") instanceof Map<?,?> p?(Map<String,Object>)p:Map.<String,Object>of();
        var value=RecordedMapPreferences.merge(existing,patch);
        // jsonb_set modifies only map; theme, units, privacy and filters survive.
        jdbc.update("UPDATE statshunters.account_profiles SET preferences=jsonb_set(preferences,'{map}',?::jsonb,true),dataset_revision=dataset_revision+1 WHERE runner_id=?",json(value),runner.getId());
        return map("preferences",value,"revision",revision+1,"snapshot",snapshot(new Owner(owner.runner,revision+1,owner.zone,owner.preferences)));
    }
    private static void keys(Map<String,Object> input,String...allowed){if(!Set.of(allowed).containsAll(input.keySet()))throw new IllegalArgumentException("Unknown map query field");}
    @SuppressWarnings("unchecked") private static Map<String,Object> filter(Map<String,Object> query) {
        Object raw=query.get("filter");if(raw!=null&&!(raw instanceof Map<?,?>))throw new IllegalArgumentException("Invalid filter");
        var f=raw==null?new LinkedHashMap<String,Object>():new LinkedHashMap<>((Map<String,Object>)raw);
        keys(f,"q","from","to","sport","gear","sourceSport","subtype","commute","trainer","minDistanceKm","maxDistanceKm","minMinutes","maxMinutes","minAscentM","maxAscentM","minSpeedKmh","maxSpeedKmh","minHeartRate","maxHeartRate");
        for(String key:List.of("q","from","to","sport","gear","sourceSport","subtype","commute","trainer")) {
            String value=Objects.toString(f.get(key),"").trim();if(value.length()>(key.equals("gear")?167:160))throw new IllegalArgumentException("Filter is too long");f.put(key,value);
        }
        for(String key:List.of("from","to"))if(!f.get(key).equals(""))try{LocalDate.parse(f.get(key).toString());}catch(Exception e){throw new IllegalArgumentException("Invalid calendar date");}
        if(!f.get("from").equals("")&&!f.get("to").equals("")&&f.get("from").toString().compareTo(f.get("to").toString())>0)throw new IllegalArgumentException("Date range is reversed");
        if(!Set.of("","RUN","NON_RUN","UNKNOWN").contains(f.get("sport")))throw new IllegalArgumentException("Invalid workout type");
        String gear=f.get("gear").toString();
        if(!gear.isEmpty()&&!gear.equals("UNKNOWN")&&!gear.matches("[1-9][0-9]{0,18}")&&!(gear.startsWith("source:")&&gear.length()>7&&!gear.matches(".*\\p{Cntrl}.*")))throw new IllegalArgumentException("Invalid gear");
        for(String key:List.of("commute","trainer"))if(!Set.of("","yes","no","unknown").contains(f.get(key)))throw new IllegalArgumentException("Invalid activity flag");
        for(String key:METRICS) {
            Object value=f.get(key);if(value==null||value.equals("")){f.remove(key);continue;}
            if(!(value instanceof Number n)||!Double.isFinite(n.doubleValue())||n.doubleValue()<0||n.doubleValue()>1e7)throw new IllegalArgumentException("Invalid metric range");
            f.put(key,n.doubleValue());
        }
        for(String minimum:METRICS)if(minimum.startsWith("min")) {
            String maximum="max"+minimum.substring(3);
            if(f.containsKey(minimum)&&f.containsKey(maximum)&&((Number)f.get(minimum)).doubleValue()>((Number)f.get(maximum)).doubleValue())throw new IllegalArgumentException("Metric range is reversed");
        }
        return f;
    }
    private static boolean matches(Map<String,Object> run,Map<String,Object> f) {
        if(!run.get("name").toString().toLowerCase(Locale.ROOT).contains(f.get("q").toString().toLowerCase(Locale.ROOT)))return false;
        if(!f.get("sport").equals("")&&!f.get("sport").equals(run.get("sport")))return false;
        String gear=f.get("gear").toString();
        if(gear.equals("UNKNOWN")) {if(run.get("gearId")!=null||run.get("sourceGear")!=null)return false;}
        else if(gear.startsWith("source:")) {if(!gear.substring(7).equals(run.get("sourceGear")))return false;}
        else if(!gear.isEmpty()&&!gear.equals(Objects.toString(run.get("gearId"),"")))return false;
        for(String key:List.of("sourceSport","subtype"))if(!f.get(key).equals("")&&!f.get(key).equals(Objects.toString(run.get(key),"UNKNOWN")))return false;
        for(String key:List.of("commute","trainer")) {
            Object value=run.get(key);String choice=f.get(key).toString();
            if(choice.equals("unknown")&&value!=null||choice.equals("yes")&&!Boolean.TRUE.equals(value)||choice.equals("no")&&!Boolean.FALSE.equals(value))return false;
        }
        String date=Objects.toString(run.get("date"),"");
        if(!f.get("from").equals("")&&(date.isEmpty()||date.compareTo(f.get("from").toString())<0))return false;
        if(!f.get("to").equals("")&&(date.isEmpty()||date.compareTo(f.get("to").toString())>0))return false;
        for(String key:METRICS)if(f.containsKey(key)) {
            String metric=key.endsWith("Minutes")?"movingSeconds":key.endsWith("AscentM")?"ascentM":key.endsWith("SpeedKmh")?"speedKmh":key.endsWith("HeartRate")?"averageHeartRate":"distanceKm";
            Object raw=run.get(metric);if(!(raw instanceof Number n)||!Double.isFinite(n.doubleValue()))return false;
            double value=n.doubleValue()/(key.endsWith("Minutes")?60:1),threshold=((Number)f.get(key)).doubleValue();
            if(key.startsWith("min")?value<threshold:value>threshold)return false;
        }
        return true;
    }
    private String snapshot(Owner owner){return owner.runner+":"+owner.revision+":"+owner.zone+":route-v4";}
    private void expected(Owner owner,Object expected){if(expected!=null&&!snapshot(owner).equals(expected))throw new ResponseStatusException(CONFLICT,"Your history changed. Reload the map.");}
    private List<Map<String,Object>> metadata(Owner owner) {
        return jdbc.query("""
            SELECT a.id,a.name,a.activity_type,a.provider,a.start_time,a.created_at,a.strava_api_sourced,
                   a.distance_km,a.distance_meters,a.moving_time_seconds,a.total_elevation_gain,a.average_heart_rate,
                   a.shoe_id,coalesce(s.nickname,concat_ws(' ',s.brand,s.model)) AS gear,
                   f.sport AS source_sport,f.subtype,f.commute,f.trainer,f.gear AS source_gear,f.metadata::text AS source_metadata
            FROM public.activities a LEFT JOIN public.shoes s ON s.id=a.shoe_id
            LEFT JOIN statshunters.activity_facts f ON f.legacy_activity_id=a.id AND f.runner_id=a.runner_id
                 AND f.user_id=(SELECT id FROM statshunters.account_profiles WHERE runner_id=a.runner_id)
            WHERE a.runner_id=? ORDER BY coalesce(a.start_time,a.created_at) DESC,a.id DESC
            """,(row,n)->{
                LocalDateTime start=row.getObject("start_time",LocalDateTime.class),created=row.getObject("created_at",LocalDateTime.class);
                LocalDate date=start==null?(created==null?null:created.toLocalDate()):row.getBoolean("strava_api_sourced")?start.toLocalDate():start.atOffset(ZoneOffset.UTC).atZoneSameInstant(ZoneId.of(owner.zone)).toLocalDate();
                Double metres=finiteDistance(row.getObject("distance_meters"),1000),distance=metres!=null&&metres>0?metres:finiteDistance(row.getObject("distance_km"),1);if(distance==null)distance=metres;
                var source=row.getString("source_metadata")==null?Map.<String,Object>of():object(row.getString("source_metadata"));
                String sourceSport=shortText(source.get("originalSport"));if(sourceSport==null)sourceSport=shortText(row.getString("source_sport"));
                Object moving=row.getObject("moving_time_seconds");Double speed=distance!=null&&moving instanceof Number seconds&&seconds.doubleValue()>0?distance*3600/seconds.doubleValue():null;
                return map("id",row.getLong("id"),"name",Objects.toString(row.getString("name"),""),"sport",Objects.toString(row.getString("activity_type"),"UNKNOWN"),
                    "provider",row.getString("provider"),"date",date==null?null:date.toString(),"startInstant",start==null?null:(row.getBoolean("strava_api_sourced")?start.atZone(ZoneId.of(owner.zone)).toInstant():start.toInstant(ZoneOffset.UTC)).toString(),"distanceKm",distance,"movingSeconds",row.getObject("moving_time_seconds"),
                    "ascentM",row.getObject("total_elevation_gain"),"averageHeartRate",row.getObject("average_heart_rate"),"speedKmh",speed,"gearId",row.getObject("shoe_id"),"gear",row.getString("gear"),
                    "sourceSport",sourceSport,"subtype",shortText(row.getString("subtype")),"commute",row.getObject("commute"),"trainer",row.getObject("trainer"),
                    "sourceGear",shortText(row.getString("source_gear")),"device",device(source));
            },owner.runner);
    }
    private static String shortText(Object raw){if(!(raw instanceof String text))return null;text=text.strip().replaceAll("[\\p{Cntrl}]","");return text.isEmpty()?null:text.substring(0,Math.min(160,text.length()));}
    private static Double finiteDistance(Object raw,double scale){if(!(raw instanceof Number n)||!Double.isFinite(n.doubleValue())||n.doubleValue()<0)return null;return n.doubleValue()/scale;}
    private static String device(Map<String,Object> source){
        for(Object raw:new Object[]{source.get("deviceName"),source.get("device")}){String text=shortText(raw);if(text!=null)return text;if(raw instanceof Map<?,?> object)for(String key:List.of("name","model")){text=shortText(object.get(key));if(text!=null)return text;}}
        return null;
    }
    private static List<double[]> prepared(List<double[]> source,int zoom){return zoom<0?source:RecordedGeometry.simplify(source,zoom,.75);}
    private List<Line> readLines(Owner owner,int zoom,Long only) {
        return readLines(owner,zoom,only,null);
    }
    private List<Line> readLines(Owner owner,int zoom,Long only,BiConsumer<Long,List<Line>> coverage) {
        var lines=new ArrayList<Line>();var points=new ArrayList<RecordedGeometry.Fix>();long[] activity={-1};
        long[] processed={0};
        Runnable finish=()->{if(activity[0]<0)return;int index=0;var current=new ArrayList<Line>();for(var segment:RecordedGeometry.split(points))current.add(new Line(activity[0],index++,prepared(segment,zoom),segment.size(),false));if(coverage==null)lines.addAll(current);else coverage.accept(activity[0],current);points.clear();};
        jdbc.query(connection->{
            var statement=connection.prepareStatement("SELECT ap.activity_id,ap.sequence_index,ap.latitude,ap.longitude FROM public.activity_points ap JOIN public.activities a ON a.id=ap.activity_id WHERE a.runner_id=?"+(only==null?"":" AND a.id=?")+" ORDER BY ap.activity_id,ap.sequence_index");
            statement.setLong(1,owner.runner);if(only!=null)statement.setLong(2,only);statement.setFetchSize(2048);return statement;
        },(RowCallbackHandler)row->{long id=row.getLong(1);if(activity[0]!=id){finish.run();activity[0]=id;}
            if(coverage!=null&&++processed[0]>10_000_000)throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"Retained history exceeds its point processing budget");
            if(points.size()>=1_000_000)throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"This workout exceeds the map processing limit");
            Object lat=row.getObject(3),lon=row.getObject(4);
            points.add(new RecordedGeometry.Fix(row.getInt(2),lat instanceof Number n?n.doubleValue():Double.NaN,lon instanceof Number n?n.doubleValue():Double.NaN));
        });finish.run();
        // File projections retain original track-segment boundaries which older
        // canonical point rows cannot express. Prefer these when available.
        jdbc.query("SELECT f.legacy_activity_id,t.segments::text FROM statshunters.activity_facts f JOIN statshunters.track_segments t ON t.activity_id=f.id AND t.user_id=f.user_id JOIN public.activities a ON a.id=f.legacy_activity_id WHERE a.runner_id=? AND f.runner_id=a.runner_id AND f.user_id=(SELECT id FROM statshunters.account_profiles WHERE runner_id=a.runner_id)"+(only==null?"":" AND a.id=?"),
            (RowCallbackHandler)row->{
                long id=row.getLong(1);try {
                    List<List<Map<String,Object>>> segments=JSON.readValue(row.getString(2),new TypeReference<>(){});
                    var replacement=new ArrayList<Line>();int index=0;
                    for(var source:segments){var fixed=new ArrayList<RecordedGeometry.Fix>();int sequence=0;for(var p:source)fixed.add(new RecordedGeometry.Fix(sequence++,((Number)p.get("lat")).doubleValue(),((Number)p.get("lon")).doubleValue()));
                        for(var segment:RecordedGeometry.split(fixed))replacement.add(new Line(id,index++,prepared(segment,zoom),segment.size(),true));}
                    if(coverage==null){lines.removeIf(line->line.activity==id);lines.addAll(replacement);}else coverage.accept(id,replacement);
                }catch(ResponseStatusException e){throw e;}catch(Exception e){throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"Stored track segments are invalid");}
            },only==null?new Object[]{owner.runner}:new Object[]{owner.runner,only});
        if(lines.stream().mapToLong(line->line.points.size()).sum()>1_000_000)throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"This map exceeds the display processing limit");
        lines.sort(Comparator.comparingLong(Line::activity).thenComparingInt(Line::index));return lines;
    }
    private Dataset data(Owner owner,int zoom) {
        String key=snapshot(owner)+":"+zoom;long now=System.currentTimeMillis();
        synchronized(cache){var found=cache.get(key);if(found!=null&&now-found.builtAt<120_000)return found;
            var result=new Dataset(now,metadata(owner),readLines(owner,zoom,null));cache.put(key,result);
            while(cache.size()>1&&(cache.size()>4||cache.values().stream().flatMap(d->d.lines.stream()).mapToLong(l->l.points.size()).sum()>1_000_000))cache.remove(cache.keySet().iterator().next());return result;}
    }
    private static double[] bounds(List<Line> lines){double[] b={90,180,-90,-180};for(var line:lines)for(var p:line.points){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b[0]>b[2]?null:b;}
    private static boolean visible(Line line,double[] b){if(b==null)return true;double[] r=bounds(List.of(line));return r!=null&&r[0]<=b[2]&&r[2]>=b[0]&&r[1]<=b[3]&&r[3]>=b[1];}
    private static double[] bbox(Object raw){if(raw==null)return null;if(!(raw instanceof List<?> b)||b.size()!=4)throw new IllegalArgumentException("Invalid viewport");double[] v=new double[4];for(int i=0;i<4;i++){if(!(b.get(i) instanceof Number n)||!Double.isFinite(n.doubleValue()))throw new IllegalArgumentException("Invalid viewport");v[i]=n.doubleValue();}if(v[0]<-85.051129||v[2]>85.051129||v[1]<-180||v[3]>180||v[0]>=v[2]||v[1]>=v[3])throw new IllegalArgumentException("Invalid viewport");return v;}
    private byte[] mac(String value){try{var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(cursorKey,"HmacSHA256"));return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));}catch(Exception e){throw new IllegalStateException(e);}}
    private String context(Owner owner,Object...values){return snapshot(owner)+":"+json(values);}
    private String cursor(String context,int line,int point){String payload=context+"\n"+line+":"+point;var b64=Base64.getUrlEncoder().withoutPadding();return b64.encodeToString(payload.getBytes(StandardCharsets.UTF_8))+"."+b64.encodeToString(mac(payload));}
    private int[] position(Object raw,String context){if(raw==null||raw.equals(""))return new int[]{0,0};try{if(raw.toString().length()>4096)throw new IllegalArgumentException();String[] parts=raw.toString().split("\\.");String payload=new String(Base64.getUrlDecoder().decode(parts[0]),StandardCharsets.UTF_8);if(parts.length!=2||!MessageDigest.isEqual(mac(payload),Base64.getUrlDecoder().decode(parts[1]))||!payload.startsWith(context+"\n"))throw new IllegalArgumentException();String[] p=payload.substring(context.length()+1).split(":");int a=Integer.parseInt(p[0]),b=Integer.parseInt(p[1]);if(a<0||b<0)throw new IllegalArgumentException();return new int[]{a,b};}catch(Exception e){throw new ResponseStatusException(CONFLICT,"Map cursor expired. Reload this selection.");}}
    private Map<String,Object> page(Owner owner,List<Line> lines,String context,Object raw) {
        var position=position(raw,context);int index=position[0],point=position[1],used=0,bytesUsed=0;var parts=new ArrayList<Map<String,Object>>();
        if(index>lines.size())throw new IllegalArgumentException("Invalid map cursor");
        while(index<lines.size()&&used<VERTICES-1&&parts.size()<PARTS) {
            var line=lines.get(index);if(point>=line.points.size())throw new IllegalArgumentException("Invalid track position");
            int end=Math.min(line.points.size(),point+VERTICES-used);
            var part=map("activityId",line.activity,"segmentId",line.index,"part",point,"coordinates",line.points.subList(point,end),"sourcePointCount",line.sourceCount,"retainedPointCount",line.points.size(),"sourceSegmentsKnown",line.sourceSegments);
            int bytes=json(part).getBytes(StandardCharsets.UTF_8).length,remaining=GEOMETRY_BYTES-bytesUsed;
            // Keep room for owner-scoped metadata within the unchanged 512 KiB
            // response cap, including unusually precise coordinate strings.
            while(bytes>remaining&&end-point>2){
                end=point+Math.max(2,Math.min(end-point-1,(int)((long)(end-point)*remaining/bytes*.95)));
                part.put("coordinates",line.points.subList(point,end));bytes=json(part).getBytes(StandardCharsets.UTF_8).length;
            }
            if(bytes>remaining)break;
            parts.add(part);bytesUsed+=bytes;used+=end-point;
            if(end==line.points.size()){index++;point=0;}else{point=end-1;break;}
        }
        var result=map("segments",parts,"snapshot",snapshot(owner),"complete",index>=lines.size(),"nextCursor",index>=lines.size()?null:cursor(context,index,point),"displayTolerancePx",.75);
        if(json(result).getBytes(StandardCharsets.UTF_8).length>512*1024)throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"Map page exceeds its response budget");return result;
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ) public Map<String,Object> query(Runner runner,Map<String,Object> query) {
        keys(query,"filter","bbox","zoom","snapshot","cursor");var owner=owner(runner);expected(owner,query.get("snapshot"));var f=filter(query);double[] b=bbox(query.get("bbox"));
        int zoom=query.get("zoom") instanceof Number n?n.intValue():14;if(query.containsKey("zoom")&&(!(query.get("zoom") instanceof Number n)||!Double.isFinite(n.doubleValue())||n.doubleValue()!=zoom)||zoom<0||zoom>20)throw new IllegalArgumentException("Invalid zoom");
        int level=Math.min(20,Math.max(3,((zoom+2)/3)*3));var data=data(owner,level);var matches=data.workouts.stream().filter(run->matches(run,f)).toList();
        var ids=new HashSet<Long>();for(var run:matches)ids.add(((Number)run.get("id")).longValue());var all=data.lines.stream().filter(line->ids.contains(line.activity)).toList();
        var visible=all.stream().filter(line->visible(line,b)).toList();var result=page(owner,visible,context(owner,f,b,level),query.get("cursor"));
        var gps=new HashSet<Long>();for(var line:all)gps.add(line.activity);
        double distance=matches.stream().mapToDouble(run->run.get("distanceKm") instanceof Number n?n.doubleValue():0).sum();double moving=matches.stream().mapToDouble(run->run.get("movingSeconds") instanceof Number n?n.doubleValue():0).sum();
        result.put("summary",map("activityCount",matches.size(),"gpsActivityCount",gps.size(),"distanceKm",distance,"movingSeconds",moving));result.put("bounds",bounds(all));
        Long latest=matches.stream().map(run->((Number)run.get("id")).longValue()).filter(gps::contains).findFirst().orElse(null);
        result.put("focusBounds",latest==null?null:bounds(all.stream().filter(line->line.activity==latest).toList()));
        var gears=new LinkedHashMap<String,String>();for(var run:data.workouts)if(run.get("gearId")!=null)gears.put(run.get("gearId").toString(),Objects.toString(run.get("gear"),""));
        result.put("options",map("sports",data.workouts.stream().map(run->run.get("sport")).distinct().toList(),"gear",gears,
            "sourceSports",choices(data.workouts,"sourceSport"),"subtypes",choices(data.workouts,"subtype"),"sourceGear",choices(data.workouts,"sourceGear")));result.put("zone",owner.zone);
        result.put("geometryZoom",level);result.put("quality",map("legacyGapMetres",2000,"sourceSegmentsKnown",all.stream().allMatch(Line::sourceSegments)));
        if(json(result).getBytes(StandardCharsets.UTF_8).length>512*1024)throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"Map page exceeds its response budget");return result;
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ) public Map<String,Object> workouts(Runner runner,Map<String,Object> query) {
        keys(query,"filter","snapshot","cursor","limit","ids");var owner=owner(runner);expected(owner,query.get("snapshot"));var f=filter(query);
        int limit=query.get("limit") instanceof Number n?n.intValue():50;if(limit<1||limit>100)throw new IllegalArgumentException("Invalid page size");
        var list=metadata(owner).stream().filter(run->matches(run,f)).toList();
        if(query.containsKey("ids")) {
            if(query.containsKey("cursor")||!(query.get("ids") instanceof List<?> ids)||ids.isEmpty()||ids.size()>8)throw new IllegalArgumentException("Invalid workout lookup");
            var selected=new HashSet<Long>();for(Object raw:ids)try{String text=raw.toString();if(!text.matches("[1-9][0-9]{0,18}"))throw new IllegalArgumentException();selected.add(Long.parseLong(text));}catch(Exception e){throw new IllegalArgumentException("Invalid workout identity");}
            return map("items",list.stream().filter(run->selected.contains(((Number)run.get("id")).longValue())).toList(),"snapshot",snapshot(owner),"nextCursor",null);
        }
        String context=context(owner,"workouts",f);int offset=0;
        if(query.get("cursor")!=null) {
            String value=query.get("cursor").toString();if(value.length()>4096)throw new IllegalArgumentException("Invalid workout cursor");
            try {
                var parts=value.split("\\.");var payload=new String(Base64.getUrlDecoder().decode(parts[0]),StandardCharsets.UTF_8);
                if(parts.length!=2||!MessageDigest.isEqual(mac(payload),Base64.getUrlDecoder().decode(parts[1]))||!payload.startsWith(context+"\n"))throw new IllegalArgumentException();
                long after=Long.parseLong(payload.substring(context.length()+1));boolean found=false;
                for(int i=0;i<list.size();i++)if(((Number)list.get(i).get("id")).longValue()==after){offset=i+1;found=true;break;}
                if(!found)throw new IllegalArgumentException();
            }catch(Exception e){throw new ResponseStatusException(CONFLICT,"Workout cursor expired. Reload this selection.");}
        }
        int end=Math.min(list.size(),offset+limit);String next=null;
        if(end<list.size()) {String payload=context+"\n"+list.get(end-1).get("id");var encoder=Base64.getUrlEncoder().withoutPadding();next=encoder.encodeToString(payload.getBytes(StandardCharsets.UTF_8))+"."+encoder.encodeToString(mac(payload));}
        return map("items",list.subList(offset,end),"matchingCount",list.size(),"snapshot",snapshot(owner),"nextCursor",next);
    }
    private static List<String> choices(List<Map<String,Object>> workouts,String key){return workouts.stream().map(run->run.get(key)).filter(Objects::nonNull).map(Object::toString).distinct().sorted().toList();}
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ) public Map<String,Object> track(Runner runner,long id,String snapshot,String cursor,int zoom) {
        var owner=owner(runner);expected(owner,snapshot);if(zoom<0||zoom>20)throw new IllegalArgumentException("Invalid zoom");
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.activities WHERE id=? AND runner_id=?)",Boolean.class,id,runner.getId())))throw new ResponseStatusException(NOT_FOUND,"Workout unavailable");
        return page(owner,readLines(owner,zoom,id),context(owner,"track",id,zoom),cursor);
    }
    private TileDataset tileData(Owner owner) {
        String key=snapshot(owner);long now=System.currentTimeMillis();
        synchronized(tileCache){
            var previous=tileCache.get(key);if(previous!=null&&now-previous.builtAt<120_000)return previous;
            var cellsById=new HashMap<Long,Set<Long>>();var provenance=new HashMap<Long,Map<String,Object>>();
            readLines(owner,-1,null,(id,source)->{
                cellsById.put(id,RecordedWorkoutTiles.cells(source.stream().map(Line::points).toList()));
                provenance.put(id,map("basis","retained-history","source",source.isEmpty()?"unavailable":source.stream().allMatch(Line::sourceSegments)?"retained-segments":"canonical-points","sourcePointCount",source.stream().mapToInt(Line::sourceCount).sum(),"segmentCount",source.size(),"legacyGapMetres",2000));
            });
            var visits=new ArrayList<RecordedWorkoutTiles.Visit>();int memberships=0;
            for(var run:metadata(owner)){
                long id=((Number)run.get("id")).longValue();var cells=cellsById.getOrDefault(id,Set.of());
                memberships+=cells.size();if(memberships>RecordedWorkoutTiles.MAX_MEMBERSHIPS)throw new ResponseStatusException(UNPROCESSABLE_CONTENT,"Retained history exceeds its coverage budget");
                visits.add(new RecordedWorkoutTiles.Visit(id,run.get("startInstant")==null?null:Instant.parse(run.get("startInstant").toString()),cells));
                provenance.putIfAbsent(id,map("basis","retained-history","source","unavailable","sourcePointCount",0,"segmentCount",0,"legacyGapMetres",2000));
            }
            TileDataset result;
            try{result=new TileDataset(now,RecordedWorkoutTiles.history(visits),Map.copyOf(provenance));}catch(IllegalArgumentException e){throw new ResponseStatusException(UNPROCESSABLE_CONTENT,e.getMessage());}
            tileCache.put(key,result);while(tileCache.size()>2)tileCache.remove(tileCache.keySet().iterator().next());return result;
        }
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ) public Map<String,Object> tiles(Runner runner,long id,String snapshot,String cursor) {
        var owner=owner(runner);expected(owner,snapshot);
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.activities WHERE id=? AND runner_id=?)",Boolean.class,id,runner.getId())))throw new ResponseStatusException(NOT_FOUND,"Workout unavailable");
        var data=tileData(owner);var counts=data.counts.get(id);if(counts==null)throw new ResponseStatusException(CONFLICT,"Your history changed. Reload the map.");
        var added=counts.added()==null?List.<Long>of():counts.added();String context=context(owner,"tiles",id);int[] position=position(cursor,context);int start=position[0];
        if(start>added.size()||position[1]!=0)throw new IllegalArgumentException("Invalid tile cursor");int end=Math.min(start+500,added.size());
        return map("snapshot",snapshot(owner),"tileZoom",RecordedWorkoutTiles.ZOOM,"tileCount",counts.visited().isEmpty()?null:counts.visited().size(),"newTileCount",counts.visited().isEmpty()||counts.added()==null?null:counts.added().size(),
            "cells",added.subList(start,end).stream().map(RecordedWorkoutTiles::coordinates).toList(),"complete",end>=added.size(),"nextCursor",end>=added.size()?null:cursor(context,end,0),"quality",data.provenance.get(id));
    }
}
