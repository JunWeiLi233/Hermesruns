package com.hermes.backend.explorer;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

final class ExplorerJson {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final SecureRandom RANDOM = new SecureRandom();
    private ExplorerJson() {}
    static String write(Object value) {
        try { return JSON.writeValueAsString(value); }
        catch (Exception e) { throw new IllegalArgumentException("Unsupported Explorer data."); }
    }
    static Map<String,Object> object(String value) {
        try { return JSON.readValue(value, new TypeReference<LinkedHashMap<String,Object>>() {}); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid Explorer object."); }
    }
    static Object read(String value) {
        try { return JSON.readValue(value, Object.class); }
        catch (Exception e) { throw new IllegalArgumentException("Invalid Explorer data."); }
    }
    static String hash(String text) { return hash(text.getBytes(StandardCharsets.UTF_8)); }
    static String hash(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    static String secret() { byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
    static Map<String,Object> map(Object... pairs) {
        Map<String,Object> map = new LinkedHashMap<>();
        for (int i=0;i<pairs.length;i+=2) map.put((String)pairs[i],pairs[i+1]);
        return map;
    }
}
