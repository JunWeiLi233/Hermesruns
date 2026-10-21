package com.hermes.backend.heatmap;

import java.time.Instant;
import java.util.*;

/** Independent half-open z14 coverage from unsimplified retained segments. */
final class RecordedWorkoutTiles {
    static final int ZOOM=14, GRID=1<<ZOOM, MAX_MEMBERSHIPS=250_000;
    record Visit(long id,Instant start,Set<Long> cells) {}
    record Counts(Set<Long> visited,List<Long> added) {}
    static long cell(int x,int y){return ((long)Math.floorMod(x,GRID)<<ZOOM)|y;}
    static List<Integer> coordinates(long cell){return List.of((int)(cell>>ZOOM),(int)(cell&(GRID-1)));}
    static double[] project(double[] p){
        double lat=Math.toRadians(p[0]);
        return new double[]{(p[1]+180)/360*GRID,Math.max(0,Math.min(GRID-1e-8,(1-Math.log(Math.tan(Math.PI/4+lat/2))/Math.PI)/2*GRID))};
    }
    static Set<Long> cells(List<List<double[]>> segments) {
        var cells=new TreeSet<Long>();
        for(var segment:segments)for(int i=0;i<segment.size();i++) {
            var a=project(segment.get(i));var b=project(segment.get(Math.min(i+1,segment.size()-1)));
            int x=(int)Math.floor(a[0]),y=(int)Math.floor(a[1]),endX=(int)Math.floor(b[0]),endY=(int)Math.floor(b[1]);
            double dx=b[0]-a[0],dy=b[1]-a[1];int sx=(int)Math.signum(dx),sy=(int)Math.signum(dy);
            double tx=dx==0?Double.POSITIVE_INFINITY:((sx>0?x+1:x)-a[0])/dx,ty=dy==0?Double.POSITIVE_INFINITY:((sy>0?y+1:y)-a[1])/dy;
            int guard=0;
            while(true) {
                if(y>=0&&y<GRID)cells.add(cell(x,y));
                if(cells.size()>MAX_MEMBERSHIPS||++guard>GRID*2+4)throw new IllegalArgumentException("Retained coverage exceeds its processing budget");
                if(x==endX&&y==endY)break;
                if(x==endX){y+=sy;ty+=Math.abs(1/dy);}
                else if(y==endY){x+=sx;tx+=Math.abs(1/dx);}
                else if(Math.abs(tx-ty)<1e-10){x+=sx;y+=sy;tx+=Math.abs(1/dx);ty+=Math.abs(1/dy);}
                else if(tx<ty){x+=sx;tx+=Math.abs(1/dx);}else{y+=sy;ty+=Math.abs(1/dy);}
            }
        }
        return Collections.unmodifiableSet(cells);
    }
    static Map<Long,Counts> history(List<Visit> visits) {
        var unknown=new HashSet<Long>();var seen=new HashSet<Long>();var result=new HashMap<Long,Counts>();
        int memberships=0;
        for(var visit:visits){memberships+=visit.cells.size();if(memberships>MAX_MEMBERSHIPS)throw new IllegalArgumentException("Retained history exceeds its coverage budget");if(visit.start==null)unknown.addAll(visit.cells);}
        var ordered=visits.stream().sorted(Comparator.comparing(Visit::start,Comparator.nullsLast(Comparator.naturalOrder())).thenComparingLong(Visit::id)).toList();
        for(var visit:ordered){
            var added=new TreeSet<>(visit.cells);added.removeAll(seen);
            boolean known=visit.start!=null&&Collections.disjoint(added,unknown);
            result.put(visit.id,new Counts(visit.cells,known?List.copyOf(added):null));
            if(visit.start!=null)seen.addAll(visit.cells);
        }
        return Map.copyOf(result);
    }
}
