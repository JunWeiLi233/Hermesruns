package com.hermes.backend.heatmap;

import java.util.*;

public final class RecordedMapPreferences {
    private RecordedMapPreferences() {}
    public static Map<String,Object> defaults() {
        var value=new LinkedHashMap<String,Object>();value.put("mode","lines");value.put("basemap","streets");
        value.put("weight",1.6);value.put("color","#ff3038");value.put("hoverColor","#ef1818");value.put("highlightColor","#151b22");return value;
    }
    public static Map<String,Object> merge(Map<String,Object> previous,Map<String,Object> patch) {
        var result=defaults();if(previous!=null)for(var key:result.keySet())if(previous.containsKey(key))result.put(key,previous.get(key));
        if(patch==null||!result.keySet().containsAll(patch.keySet()))throw new IllegalArgumentException("Unknown map preference");
        result.putAll(patch);
        if(!(result.get("mode") instanceof String mode)||!Set.of("lines","heat").contains(mode)||!(result.get("basemap") instanceof String basemap)||!Set.of("streets","dark").contains(basemap))throw new IllegalArgumentException("Invalid map mode");
        if(!(result.get("weight") instanceof Number n)||!Double.isFinite(n.doubleValue())||n.doubleValue()<.75||n.doubleValue()>6)throw new IllegalArgumentException("Invalid line width");
        for(String key:List.of("color","hoverColor","highlightColor"))if(!(result.get(key) instanceof String s)||!s.matches("#[0-9a-fA-F]{6}"))throw new IllegalArgumentException("Invalid map color");
        return result;
    }
}
