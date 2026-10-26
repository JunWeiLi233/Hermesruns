package com.hermes.backend.training;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.*;

/** Only installed inside the training chain. It never reads the administrator portal cookie. */
final class TrainingCookieFilter extends OncePerRequestFilter {
    final AuthService auth;
    TrainingCookieFilter(AuthService auth){this.auth=auth;}
    static String credential(HttpServletRequest request){
        String explicit=request.getHeader("Authorization");if(explicit!=null&&!explicit.isBlank())return explicit;
        if(request.getCookies()!=null)for(Cookie cookie:request.getCookies())if(cookie.getName().equals("hermes_training"))return "Bearer "+cookie.getValue();return null;
    }
    protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException {
        response.setHeader("Cache-Control","no-store");String credential=credential(request);
        if(credential!=null){Optional<Runner> actor=auth.findByAuthorizationHeader(credential);if(actor.isPresent())SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor.get(),null,List.of()));else SecurityContextHolder.clearContext();}
        try{chain.doFilter(request,response);}finally{SecurityContextHolder.clearContext();}
    }
}
