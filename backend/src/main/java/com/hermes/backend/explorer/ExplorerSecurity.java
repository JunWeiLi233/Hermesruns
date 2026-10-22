package com.hermes.backend.explorer;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerSecurity {
    static final String COOKIE="hermes_explorer";
    private final AuthService auth;
    private final boolean secure;
    private final Set<String> origins;
    public ExplorerSecurity(AuthService auth,@Value("${app.explorer.cookie-secure:true}") boolean secure,
            @Value("${app.explorer.allowed-origins:}") String origins) {
        this.auth=auth;this.secure=secure;this.origins=new HashSet<>(Arrays.asList(origins.split(",")));
        if(!secure && this.origins.stream().filter(s->!s.isBlank()).anyMatch(s->!isLoopback(s))) {
            throw new IllegalStateException("Insecure Explorer cookies are allowed only on loopback origins.");
        }
    }
    static boolean isLoopback(String origin) {
        try {return Set.of("localhost","127.0.0.1","[::1]","::1").contains(URI.create(origin).getHost());}
        catch(RuntimeException e) {return false;}
    }
    String issue(String token,boolean persistent) {return cookie(token,persistent?Duration.ofDays(30):null);}
    String clear() {return cookie("",Duration.ZERO);}
    private String cookie(String token,Duration age) {
        var cookie=ResponseCookie.from(COOKIE,token).httpOnly(true).secure(secure).sameSite("Strict").path("/api/explorer");
        if(age!=null) cookie.maxAge(age);return cookie.build().toString();
    }
    static String csrf(String token) {return ExplorerJson.hash("hermes-explorer-csrf-v1:"+token);}
    static String token(HttpServletRequest request) {
        if(request.getCookies()!=null) for(Cookie c:request.getCookies()) if(COOKIE.equals(c.getName()) && c.getValue().length()<=128) return c.getValue();
        return null;
    }
    static String credential(HttpServletRequest request) {
        String header=request.getHeader("Authorization");
        if(header!=null && !header.isBlank()) return header.startsWith("Bearer ") && header.length()<=256 ? header.substring(7) : null;
        return token(request);
    }
    @Bean @Order(1)
    SecurityFilterChain explorerSecurityChain(HttpSecurity http) throws Exception {
        // This chain never enables cookie auth on Hermes's other API routes. A session-bound CSRF
        // proof and a custom header protect every unsafe Explorer request, including login CSRF.
        return http.securityMatcher("/api/explorer/**","/explorer","/explorer/**")
                .csrf(AbstractHttpConfigurer::disable).formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable).logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new BrowserSessionFilter(),UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(a->a.requestMatchers("/api/explorer/session/**","/api/explorer/public/**","/explorer","/explorer/**").permitAll().anyRequest().authenticated())
                .exceptionHandling(e->e.authenticationEntryPoint((q,s,x)->deny(s,401,"Sign in to continue.")))
                .build();
    }
    private final class BrowserSessionFilter extends OncePerRequestFilter {
        @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
            response.setHeader("Cache-Control","no-store");response.setHeader("Referrer-Policy","no-referrer");
            if(!secure && !isLoopback(request.getRequestURL().toString())) {deny(response,503,"HTTPS is required.");return;}
            boolean unsafe=!Set.of("GET","HEAD","OPTIONS").contains(request.getMethod());
            if(unsafe) {
                String origin=request.getHeader("Origin");
                String same=request.getScheme()+"://"+request.getServerName()+((request.getServerPort()==80||request.getServerPort()==443)?"":":"+request.getServerPort());
                if(!"1".equals(request.getHeader("X-Explorer-Request")) || (origin!=null && !origin.equals(same)&&!origins.contains(origin)) || "cross-site".equals(request.getHeader("Sec-Fetch-Site"))) {
                    deny(response,403,"The request origin could not be verified.");return;
                }
            }
            boolean bearer=request.getHeader("Authorization")!=null && !request.getHeader("Authorization").isBlank();
            String credential=credential(request);
            Optional<Runner> runner=credential==null?Optional.empty():auth.findByAuthorizationHeader("Bearer "+credential);
            // Explicit native credentials take precedence. Never choose a different
            // cookie owner after a failed Hermes bearer authentication.
            if(bearer && runner.isEmpty()) {deny(response,401,"Sign in to continue.");return;}
            boolean privateMutation=unsafe && (request.getRequestURI().equals("/api/explorer/session/logout")
                    || !request.getRequestURI().startsWith("/api/explorer/session/") && !request.getRequestURI().startsWith("/api/explorer/public/"));
            if(privateMutation && !bearer && runner.isPresent()) {
                String proof=request.getHeader("X-Explorer-CSRF");
                if(proof==null || !MessageDigest.isEqual(csrf(credential).getBytes(StandardCharsets.US_ASCII),proof.getBytes(StandardCharsets.US_ASCII))) {deny(response,403,"Reload your session before changing data.");return;}
            }
            try {
                runner.ifPresent(r->SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(r,null,List.of())));
                chain.doFilter(request,response);
            } finally {SecurityContextHolder.clearContext();}
        }
    }
    private static void deny(HttpServletResponse response,int status,String message) throws IOException {
        response.setStatus(status);response.setContentType("application/json");response.getWriter().write(ExplorerJson.write(Map.of("message",message)));
    }
}
