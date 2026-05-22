package com.hermes.backend;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class SecurityHeadersFilter implements Filter {

    @Value("${app.security.enable-hsts:true}")
    private boolean enableHsts;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        if (enableHsts) {
            httpResponse.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
        httpResponse.setHeader("X-Frame-Options", "DENY");
        httpResponse.setHeader("X-Content-Type-Options", "nosniff");
        httpResponse.setHeader("X-XSS-Protection", "1; mode=block");
        httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        // geolocation=(self): allow browser geolocation for same-origin UI (e.g. weather bar).
        httpResponse.setHeader("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
        httpResponse.setHeader("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "img-src 'self' data: https: blob:; " +
                "font-src 'self' https://fonts.gstatic.com; " +
                "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.youtube-nocookie.com; " +
                "object-src 'none'; " +
                "base-uri 'self'; " +
                "form-action 'self'; " +
                "connect-src 'self' https://www.strava.com https://accounts.google.com " +
                "https://www.google.com/recaptcha/ " +
                "https://generativelanguage.googleapis.com " +
                "https://api.stripe.com https://*.stripe.com " +
                "https://api.open-meteo.com");
        chain.doFilter(request, response);
    }
}
