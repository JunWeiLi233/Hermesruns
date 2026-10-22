package com.hermes.backend.training;

import com.hermes.backend.auth.ApiRateLimiter;
import com.hermes.backend.infrastructure.web.RequestIpResolver;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Bounds JSON before Jackson reads it; multipart files are separately bounded by the upload endpoint. */
final class TrainingLimitsFilter extends OncePerRequestFilter {
    final ApiRateLimiter limiter;
    TrainingLimitsFilter(ApiRateLimiter limiter){this.limiter=limiter;}
    protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException {
        response.setHeader("Cache-Control","no-store");
        if(!limiter.allow("training-http:"+RequestIpResolver.clientIp(request),240,60)){reject(response,429,"RATE_LIMIT");return;}
        String type=request.getContentType();
        if(type!=null&&type.toLowerCase(java.util.Locale.ROOT).startsWith("application/json")){
            if(request.getContentLengthLong()>262144){reject(response,413,"JSON_SIZE_LIMIT");return;}
            byte[] data=request.getInputStream().readNBytes(262145);if(data.length>262144){reject(response,413,"JSON_SIZE_LIMIT");return;}
            var wrapped=new HttpServletRequestWrapper(request){
                public ServletInputStream getInputStream(){var input=new ByteArrayInputStream(data);return new ServletInputStream(){
                    public int read(){return input.read();}public boolean isFinished(){return input.available()==0;}public boolean isReady(){return true;}
                    public void setReadListener(ReadListener listener){try{listener.onDataAvailable();if(isFinished())listener.onAllDataRead();}catch(IOException e){listener.onError(e);}}
                };}
                public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
            };
            chain.doFilter(wrapped,response);return;
        }
        if(type!=null&&type.startsWith("multipart/")&&request.getContentLengthLong()>21L*1024*1024){reject(response,413,"UPLOAD_SIZE_LIMIT");return;}
        chain.doFilter(request,response);
    }
    void reject(HttpServletResponse response,int status,String code)throws IOException{response.setStatus(status);response.setContentType("application/json");response.getWriter().write("{\"code\":\""+code+"\"}");}
}
