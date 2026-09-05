package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.web.SpaForwardingController;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // CSRF protection is intentionally disabled because this API is fully
        // stateless and authenticates every mutating request with an
        // `Authorization: Bearer <jwt>` header (see JwtAuthenticationFilter and
        // the frontend `apiFetch` helper), never a session cookie:
        //   - SessionCreationPolicy.STATELESS below means no HTTP session is
        //     ever created, so there is no session-bound credential to forge.
        //   - Browsers never attach an `Authorization` header automatically the
        //     way they do a cookie, so a cross-site request cannot impersonate
        //     an authenticated runner.
        //   - formLogin / httpBasic / rememberMe / logout are all disabled, so
        //     there is no cookie/session auth path that CSRF would protect.
        // Spring Security's own reference docs and the CodeQL query help both
        // recognise disabling CSRF as correct for a stateless, token-based API
        // (see https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html
        // and https://codeql.github.com/codeql-query-help/java/java-spring-disabled-csrf-protection/).
        // The CodeQL `java/spring-disabled-csrf-protection` alert is therefore a
        // documented false positive for this architecture and is dismissed as
        // such in the GitHub code-scanning UI.
        return http
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .rememberMe(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .securityContext(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Invalid or expired session token.\"}");
                        }))
                .authorizeHttpRequests(auth -> auth
                        // CORS preflight requests never carry credentials (no Authorization
                        // header), so let OPTIONS on /api/** reach the MVC CORS processor when
                        // APP_CORS_ALLOWED_ORIGINS is configured; the actual requests below
                        // still require authentication.
                        .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                        .requestMatchers(
                                "/api/auth/login", "/api/auth/signup", "/api/auth/verify-email",
                                "/api/auth/forgot-password", "/api/auth/reset-password",
                                "/api/auth/password-reset/request", "/api/auth/password-reset/confirm",
                                "/api/auth/resend-verification",
                                "/api/auth/google", "/api/auth/google/start", "/api/auth/google/callback",
                                "/api/auth/strava", "/api/auth/strava/start", "/api/auth/strava/callback",
                                "/api/auth/strava/webhook", "/api/auth/refresh",
                                "/api/auth/providers", "/api/auth/strava/status",
                                "/api/auth/password-rules", "/api/auth/ping"
                        ).permitAll()
                        .requestMatchers("/api/auth/admin-login").permitAll()
                        .requestMatchers("/api/auth/admin-mfa/**").permitAll()
                        .requestMatchers("/api/billing/stripe/webhook").permitAll()
                        // Leaflet requests basemap tiles as image URLs and cannot attach the
                        // runner's bearer token. The proxy only returns public OSM tiles, so
                        // keep this read-only endpoint available without authentication.
                        .requestMatchers("/api/maps/tiles/**").permitAll()
                        .requestMatchers("/api/dev/console-errors").authenticated()
                        .requestMatchers(
                                "/api/admin", "/api/admin/**",
                                "/api/auth/runners", "/api/auth/runners/**",
                                "/api/shoe-catalog/admin", "/api/shoe-catalog/admin/**",
                                "/api/shoes/admin", "/api/shoes/admin/**",
                                "/api/config/admin", "/api/config/admin/**",
                                "/api/dev", "/api/dev/**"
                        ).hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        // Every admin document route requires the short-lived HttpOnly portal
                        // cookie. Administrators authenticate through the normal /login page;
                        // this role rule is an independent second authorization boundary.
                        .requestMatchers("/admin", "/admin/", "/dashboard", "/dashboard/**", "/workflows")
                        .hasRole("ADMIN")
                        // Frontend SPA shell: the route list lives in exactly one place,
                        // SpaForwardingController.SPA_ROUTES, shared with the @GetMapping above.
                        // Protected admin routes have already been matched above.
                        .requestMatchers(SpaForwardingController.SPA_ROUTES.toArray(String[]::new)).permitAll()
                        // Static assets the SPA needs before a session token exists, plus the
                        // Boot /error dispatch so anonymous error paths never mask real responses.
                        // ("/" itself is already covered by SPA_ROUTES above.)
                        .requestMatchers(
                                "/index.html", "/assets/**",
                                "/favicon.ico", "/favicon.svg", "/hermes-tab-icon.svg", "/icons.svg",
                                "/robots.txt", "/sitemap.xml", "/llms.txt",
                                "/images/**",
                                "/error"
                        ).permitAll()
                        // Secure by default: anything not explicitly permitted above now
                        // requires authentication instead of silently becoming public.
                        .anyRequest().authenticated())
                .build();
    }
}
