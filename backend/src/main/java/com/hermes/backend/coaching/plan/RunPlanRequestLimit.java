package com.hermes.backend.coaching.plan;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bound the wire body before JSON deserialization, including chunked requests. */
@Component @Order(15)
class RunPlanRequestLimit extends OncePerRequestFilter {
    @Override protected boolean shouldNotFilter(HttpServletRequest request){String path=request.getRequestURI();return !Set.of("POST","PUT","PATCH").contains(request.getMethod()) || !(path.startsWith("/api/run-plans")||path.equals("/api/plan-profile")||path.equals("/api/manual-runs"));}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException {
        byte[] body=request.getInputStream().readNBytes(65537);
        if(body.length>65536){response.setStatus(413);response.setContentType("application/json");response.getWriter().write("{\"code\":\"REQUEST_TOO_LARGE\"}");return;}
        chain.doFilter(new HttpServletRequestWrapper(request){
            @Override public ServletInputStream getInputStream(){var stream=new ByteArrayInputStream(body);return new ServletInputStream(){public int read(){return stream.read();}public boolean isFinished(){return stream.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener listener){throw new UnsupportedOperationException("Synchronous JSON request");}};}
            @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
        },response);
    }
}
