package com.hermes.backend.explorer;

import com.hermes.backend.imports.ParsedActivityData;
import com.hermes.backend.imports.ParsedTrackPoint;
import java.time.ZoneOffset;
import java.util.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

/** Independent z14 half-open convention. Full source points feed coverage, never display samples. */
final class ExplorerGeometry {
    static final int GRID=16384;
    record Prepared(List<List<Map<String,Object>>> segments,Set<String> cells,int breaks,Double distanceM,Double ascentM) {}
    static Prepared prepare(ParsedActivityData activity) {
        if(activity.startTime()==null || activity.source()==null) throw new IllegalArgumentException("An explicit source start time is required.");
        if(activity.points().size()>200_000) throw new IllegalArgumentException("A source may contain at most 200,000 points. Nothing was sampled.");
        List<List<Map<String,Object>>> segments=new ArrayList<>();List<Map<String,Object>> current=new ArrayList<>();
        ParsedTrackPoint previous=null;int breaks=0;double distance=0,ascent=0;boolean elevationKnown=false;
        Integer elapsed=null;
        for(var point:activity.points()) {
            if(!Double.isFinite(point.latitude())||!Double.isFinite(point.longitude())||Math.abs(point.latitude())>85.05112878||Math.abs(point.longitude())>180) throw new IllegalArgumentException("Unsupported source coordinates.");
            if(point.elapsedSeconds()!=null && elapsed!=null && point.elapsedSeconds()<elapsed) throw new IllegalArgumentException("Source point timestamps are out of order.");
            if(point.elapsedSeconds()!=null) elapsed=point.elapsedSeconds();
            double gap=previous==null?0:metres(previous.latitude(),previous.longitude(),point.latitude(),point.longitude());
            boolean cut=previous!=null&&(previous.segmentIndex()!=point.segmentIndex()||gap>10000);
            if(cut) {if(!current.isEmpty()) segments.add(current);current=new ArrayList<>();breaks++;}
            if(previous!=null&&!cut) {
                distance+=gap;
                if(previous.elevationMeters()!=null&&point.elevationMeters()!=null&&Double.isFinite(previous.elevationMeters())&&Double.isFinite(point.elevationMeters())) {ascent+=Math.max(0,point.elevationMeters()-previous.elevationMeters());elevationKnown=true;}
            }
            current.add(map("lat",point.latitude(),"lon",point.longitude(),"time",point.elapsedSeconds()==null?null:activity.startTime().plusSeconds(point.elapsedSeconds()).toInstant(ZoneOffset.UTC).toString(),"ele",finite(point.elevationMeters())));
            previous=point;
        }
        if(!current.isEmpty()) segments.add(current);
        Set<String> cells=new LinkedHashSet<>();
        for(var segment:segments) for(int i=0;i<segment.size();i++) {
            cells.addAll(segmentCells(segment.get(i),segment.get(Math.min(i+1,segment.size()-1))));
            if(cells.size()>150_000) throw new IllegalArgumentException("This source exceeds the 150,000-cell limit.");
        }
        return new Prepared(segments,cells,breaks,activity.points().isEmpty()?null:distance,elevationKnown?ascent:null);
    }
    static Double finite(Double value) {return value!=null&&Double.isFinite(value)&&value>=0?value:null;}
    static double metres(double lat,double lon,double lat2,double lon2) {
        double r=Math.PI/180,a=Math.pow(Math.sin((lat2-lat)*r/2),2)+Math.cos(lat*r)*Math.cos(lat2*r)*Math.pow(Math.sin((lon2-lon)*r/2),2);
        return 6371008.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
    }
    private static double[] project(Map<String,Object> p) {
        double lat=((Number)p.get("lat")).doubleValue()*Math.PI/180,lon=((Number)p.get("lon")).doubleValue();
        double tangent=Math.tan(lat),asinh=Math.log(tangent+Math.sqrt(tangent*tangent+1));
        return new double[]{(lon+180)/360*GRID,Math.max(0,Math.min(GRID-1e-8,(1-asinh/Math.PI)/2*GRID))};
    }
    static Set<String> segmentCells(Map<String,Object> a,Map<String,Object> b) {
        double[] start=project(a),end=project(b);
        if(end[0]-start[0]>GRID/2d) end[0]-=GRID;if(end[0]-start[0]<-GRID/2d) end[0]+=GRID;
        int x=(int)Math.floor(start[0]),y=(int)Math.floor(start[1]),fx=(int)Math.floor(end[0]),fy=(int)Math.floor(end[1]);
        double dx=end[0]-start[0],dy=end[1]-start[1];int sx=(int)Math.signum(dx),sy=(int)Math.signum(dy);
        double stepX=dx==0?Double.POSITIVE_INFINITY:Math.abs(1/dx),stepY=dy==0?Double.POSITIVE_INFINITY:Math.abs(1/dy);
        double tx=dx==0?Double.POSITIVE_INFINITY:((sx>0?x+1:x)-start[0])/dx,ty=dy==0?Double.POSITIVE_INFINITY:((sy>0?y+1:y)-start[1])/dy;
        Set<String> cells=new LinkedHashSet<>();
        for(int guard=0;guard<GRID*2+4;guard++) {
            if(y>=0&&y<GRID) cells.add(Math.floorMod(x,GRID)+":"+y);
            if(x==fx&&y==fy) return cells;
            if(Math.abs(tx-ty)<1e-12) {x+=sx;y+=sy;tx+=stepX;ty+=stepY;} else if(tx<ty) {x+=sx;tx+=stepX;} else {y+=sy;ty+=stepY;}
        }
        throw new IllegalArgumentException("Source coverage exceeds the segment traversal limit.");
    }
    static String sport(ParsedActivityData parsed) {
        String raw=Objects.toString(parsed.source().originalSport(),"").toLowerCase(Locale.ROOT);
        if(raw.contains("cycl")||raw.contains("bik")||raw.contains("ride")) return "ride";
        if(raw.contains("walk"))return "walk";if(raw.contains("hik"))return "hike";if(raw.contains("swim"))return "swim";
        return parsed.activityType()==com.hermes.backend.activity.ActivityType.RUN?"run":"other";
    }
    static String subtype(String raw) {
        if(raw==null)return "unknown";
        return switch(raw.toLowerCase(Locale.ROOT)) {case "race","1"->"race";case "workout","3","interval"->"workout";case "regular","0"->"regular";default->"unknown";};
    }
}
