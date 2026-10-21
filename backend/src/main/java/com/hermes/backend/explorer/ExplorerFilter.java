package com.hermes.backend.explorer;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Whitelisted FilterSpec v1. HTTP UI kilometre/minute fields become SI predicates here. */
final class ExplorerFilter {
    static final Map<String,Object> EMPTY = Map.ofEntries(Map.entry("name",""),Map.entry("start",""),Map.entry("end",""),
            Map.entry("sport","all"),Map.entry("subtype","all"),Map.entry("gear","all"),Map.entry("commute","any"),
            Map.entry("trainer","any"),Map.entry("min",""),Map.entry("max",""),Map.entry("minMinutes",""),Map.entry("maxMinutes",""));
    final Map<String,Object> values;
    ExplorerFilter(Map<String,Object> input) {
        if (input==null || !EMPTY.keySet().containsAll(input.keySet())) bad();
        values = new TreeMap<>(EMPTY); values.putAll(input);
        for (var entry : values.entrySet()) {
            if (!(entry.getValue() instanceof String || entry.getValue() instanceof Number)) bad();
            if (entry.getValue().toString().length()>160 || entry.getValue().toString().chars().anyMatch(Character::isISOControl)) bad();
        }
        choice("sport",Set.of("all","run","ride","walk","hike","swim","other"));
        choice("subtype",Set.of("all","regular","workout","race","unknown"));
        for(String key:List.of("commute","trainer")) choice(key,Set.of("any","yes","no"));
        for(String key:List.of("start","end")) if(!text(key).isEmpty()) {
            try { LocalDate.parse(text(key)); } catch(RuntimeException e) { bad(); }
        }
        if(!text("start").isEmpty()&&!text("end").isEmpty()&&text("start").compareTo(text("end"))>0) bad();
        for(String key:List.of("min","max","minMinutes","maxMinutes")) number(key);
        if(number("min")!=null && number("max")!=null && number("min")>number("max")) bad();
        if(number("minMinutes")!=null && number("maxMinutes")!=null && number("minMinutes")>number("maxMinutes")) bad();
    }
    String text(String key) { return values.get(key).toString().trim(); }
    Double number(String key) {
        if(text(key).isEmpty()) return null;
        try { double value=Double.parseDouble(text(key)); if(!Double.isFinite(value)||value<0||value>1e9) bad(); return value; }
        catch(NumberFormatException e) { bad(); return null; }
    }
    private void choice(String key,Set<String> choices) { if(!choices.contains(text(key))) bad(); }
    String sql(String zone, Map<String,Object> args) {
        StringBuilder sql=new StringBuilder();
        if(!text("name").isEmpty()) { sql.append(" AND position(lower(:name) in lower(f.name))>0");args.put("name",text("name")); }
        for(String key:List.of("sport","subtype","gear")) if(!text(key).equals("all")) {sql.append(" AND f.").append(key).append("=:").append(key);args.put(key,text(key));}
        for(String key:List.of("commute","trainer")) if(!text(key).equals("any")) {sql.append(" AND f.").append(key).append("=:").append(key);args.put(key,text(key).equals("yes"));}
        if(!text("start").isEmpty()) {sql.append(" AND f.start_at>=:fromTime");args.put("fromTime",java.sql.Timestamp.from(LocalDate.parse(text("start")).atStartOfDay(ZoneId.of(zone)).toInstant()));}
        if(!text("end").isEmpty()) {sql.append(" AND f.start_at<:untilTime");args.put("untilTime",java.sql.Timestamp.from(LocalDate.parse(text("end")).plusDays(1).atStartOfDay(ZoneId.of(zone)).toInstant()));}
        for(String key:List.of("min","max","minMinutes","maxMinutes")) if(number(key)!=null) {
            sql.append(" AND f.").append(key.endsWith("Minutes")?"moving_seconds":"distance_m").append(key.startsWith("min")?">=:":"<=:").append(key);
            args.put(key,number(key)*(key.endsWith("Minutes")?60:1000));
        }
        return sql.toString();
    }
    static void bad() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid FilterSpec v1."); }
}
