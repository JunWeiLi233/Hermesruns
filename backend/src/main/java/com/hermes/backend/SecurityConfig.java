package com.hermes.backend;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import jakarta.servlet.http.HttpServletResponse;
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
                        .requestMatchers(
                                "/api/auth/login", "/api/auth/signup", "/api/auth/verify-email",
                                "/api/auth/forgot-password", "/api/auth/reset-password",
                                "/api/auth/google", "/api/auth/google/start", "/api/auth/google/callback",
                                "/api/auth/strava", "/api/auth/strava/start", "/api/auth/strava/callback",
                                "/api/auth/strava/webhook", "/api/auth/refresh",
                                "/api/auth/providers", "/api/auth/strava/status",
                                "/api/auth/password-rules", "/api/auth/ping"
                        ).permitAll()
                        .requestMatchers("/api/auth/admin-login").permitAll()
                        .requestMatchers("/api/billing/stripe/webhook").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .build();
    }
}
