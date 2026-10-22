package com.hermes.backend.infrastructure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Writes down who is on the other end of the connection, before Spring's {@code ForwardedHeaderFilter} (the setting
 * {@code server.forward-headers-strategy=framework}) gets to the request.
 *
 * <p>That filter makes {@code getRemoteAddr()} answer with the <em>first</em> address in {@code X-Forwarded-For}, whoever sent
 * it, and hides the header itself. After it, a request from a stranger who wrote {@code X-Forwarded-For: 10.9.9.9} looks like a
 * request from 10.9.9.9. So the connection's own address and the header's lines are kept here, as request attributes that only
 * the server can set, and {@link RequestIpResolver} reads those.</p>
 */
final class ClientAddressFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getAttribute(RequestIpResolver.PEER_ATTRIBUTE) == null) {
            request.setAttribute(RequestIpResolver.PEER_ATTRIBUTE, String.valueOf(request.getRemoteAddr()));
            Enumeration<String> lines = request.getHeaders("X-Forwarded-For");
            List<String> kept = lines == null ? List.of() : List.copyOf(Collections.list(lines));
            request.setAttribute(RequestIpResolver.FORWARDED_FOR_ATTRIBUTE, kept);
        }
        chain.doFilter(request, response);
    }
}
