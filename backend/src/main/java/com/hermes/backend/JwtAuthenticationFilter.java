package com.hermes.backend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Bridges Hermes JWT tokens into the Spring Security SecurityContext
 * so that filter-chain authorization rules can serve as a second
 * defense layer alongside the existing AdminSecurityFilter.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final AuthService authService;

    public JwtAuthenticationFilter(AuthService authService) {
        this.authService = authService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
            if (runnerOpt.isPresent()) {
                Runner runner = runnerOpt.get();
                List<SimpleGrantedAuthority> authorities = authService.isAdmin(runner)
                        ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                        : Collections.emptyList();
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                runner, null, authorities);
                authToken.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
