package com.hermes.backend.heatmap;

import java.util.*;

/** Independent screen-error simplification. Canonical points are never edited. */
public final class RecordedGeometry {
    private RecordedGeometry() {}
    public record Fix(int sequence,double latitude,double longitude) {}
    static boolean valid(double lat,double lon) {
        return Double.isFinite(lat)&&Double.isFinite(lon)&&Math.abs(lat)<=85.05112878&&Math.abs(lon)<=180&&!(lat==0&&lon==0);
    }
    public static List<List<double[]>> split(List<Fix> points) {
        var result=new ArrayList<List<double[]>>();var line=new ArrayList<double[]>();Fix previous=null;
        for(var p:points) {
            boolean valid=valid(p.latitude,p.longitude);
            boolean gap=previous!=null&&(p.sequence!=previous.sequence+1||Math.abs(p.longitude-previous.longitude)>180
                ||Math.hypot((p.latitude-previous.latitude)*111200,(p.longitude-previous.longitude)*111200*Math.cos(p.latitude*Math.PI/180))>2000);
            if(!valid||gap){if(line.size()>1)result.add(line);line=new ArrayList<>();}
            if(valid)line.add(new double[]{p.latitude,p.longitude});
            previous=valid?p:null;
        }
        if(line.size()>1)result.add(line);return result;
    }
    static double[] project(double[] point,int zoom) {
        double scale=256*Math.pow(2,zoom),s=Math.sin(point[0]*Math.PI/180);
        return new double[]{(point[1]+180)/360*scale,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*scale};
    }
    public static List<double[]> simplify(List<double[]> line,int zoom,double tolerance) {
        if(line.size()<3)return line.stream().map(RecordedGeometry::copyCoordinate).toList();
        double[][] pixels=line.stream().map(p->project(p,zoom)).toArray(double[][]::new);
        boolean[] keep=new boolean[line.size()];keep[0]=keep[line.size()-1]=true;
        var stack=new ArrayDeque<int[]>();stack.push(new int[]{0,line.size()-1});
        while(!stack.isEmpty()) {
            var range=stack.pop();int start=range[0],end=range[1],winner=-1;double max=tolerance*tolerance;
            double[] a=pixels[start],b=pixels[end];double dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
            for(int i=start+1;i<end;i++) {
                double t=length==0?0:Math.max(0,Math.min(1,((pixels[i][0]-a[0])*dx+(pixels[i][1]-a[1])*dy)/length));
                double x=pixels[i][0]-a[0]-t*dx,y=pixels[i][1]-a[1]-t*dy,d=x*x+y*y;
                if(d>max){max=d;winner=i;}
            }
            if(winner>=0){keep[winner]=true;stack.push(new int[]{start,winner});stack.push(new int[]{winner,end});}
        }
        var result=new ArrayList<double[]>();for(int i=0;i<line.size();i++)if(keep[i])result.add(copyCoordinate(line.get(i)));return result;
    }
    // Keep endpoint precision: rounding after simplification adds an unbudgeted
    // screen error at high zoom. Copy coordinates so cached/source data stays immutable.
    private static double[] copyCoordinate(double[] p){return new double[]{p[0],p[1]};}
}
