package com.hermes.backend.training;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.*;
import com.hermes.backend.runner.*;
import com.hermes.backend.activity.*;
import com.hermes.backend.coaching.*;
import com.hermes.backend.coaching.plan.TrainingCalendarBridge;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.*;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.Set;

@Configuration
@ConditionalOnProperty(name="app.training-workspace.enabled",havingValue="true")
public class TrainingConfiguration {
    @Bean @DependsOn("entityManagerFactory") TrainingStore trainingStore(JdbcTemplate jdbc,ObjectMapper json,PlatformTransactionManager manager,@Value("${app.training-workspace.migrate:h2}")String migrate){
        var store=new TrainingStore(jdbc,json,manager);
        boolean localH2=Boolean.TRUE.equals(jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>)connection->connection.getMetaData().getDatabaseProductName().equals("H2")));
        if("true".equals(migrate)||"h2".equals(migrate)&&localH2)store.migrate();else store.validateMigrations();return store;
    }
    @Bean TrainingAccess trainingAccess(TrainingStore store){return new TrainingAccess(store);}
    @Bean TrainingTeams trainingTeams(TrainingStore store,TrainingAccess acl){return new TrainingTeams(store,acl);}
    @Bean TrainingLibrary trainingLibrary(TrainingStore store,TrainingAccess acl){return new TrainingLibrary(store,acl);}
    @Bean TrainingCalendarBridge trainingCalendarBridge(EntityManager em){return new TrainingCalendarBridge(em);}
    @Bean TrainingAthletes trainingAthletes(TrainingStore db,TrainingAccess acl,RunnerRepository runners,ActivityRepository activities,ActivityDataAccess data,DailySleepDataRepository sleep,DailyWellnessSummaryRepository wellness,TrainingCalendarBridge calendar,EntityManager em,ApplicationEventPublisher events){return new TrainingAthletes(db,acl,runners,activities,data,sleep,wellness,calendar,em,events);}
    @Bean TrainingBulk trainingBulk(TrainingStore db,TrainingAccess acl,TrainingLibrary library,TrainingAthletes athletes){return new TrainingBulk(db,acl,library,athletes::applyPlan);}
    @Bean TrainingMessages trainingMessages(TrainingStore db,TrainingAccess acl,TrainingTeams teams,TrainingLibrary library){var messages=new TrainingMessages(db,acl,teams,library);library.conversationAccess=messages::canRead;return messages;}
    @Bean TrainingJobs trainingJobs(TrainingStore db,TrainingAthletes athletes,com.hermes.backend.imports.ActivityImportService importer,@Value("${app.training-workspace.private-directory:./.training-private}")String directory){
        return new TrainingJobs(db,java.nio.file.Path.of(directory),(actor,path,name)->{
            var result=importer.importFile(athletes.runner(actor),ImportProvider.GARMIN,TrainingJobs.upload(path,name));
            var rows=athletes.list(actor,actor);return TrainingStore.map("state",result.importedActivities()>0?"imported":result.skippedDuplicates()>0?"duplicate":"rejected","importedActivities",result.importedActivities(),"skippedDuplicates",result.skippedDuplicates(),"rejectedFiles",result.rejectedFiles(),"activities",rows.get("items"));
        });
    }
    @Bean @ConditionalOnProperty(name="app.training-workspace.jobs-enabled",havingValue="true") TrainingWorker trainingWorker(TrainingJobs jobs){return new TrainingWorker(jobs);}
    @Bean @Order(1) SecurityFilterChain trainingChain(HttpSecurity http,AuthService auth,ApiRateLimiter limiter,@Value("${app.training-workspace.cookie-secure:true}")boolean secure)throws Exception {
        var csrf=new CookieCsrfTokenRepository();csrf.setCookieName("TRAINING-XSRF");csrf.setCookiePath("/api/training");csrf.setHeaderName("X-TRAINING-CSRF");csrf.setCookieCustomizer(cookie->cookie.httpOnly(true).secure(secure).sameSite("Strict"));
        return http.securityMatcher("/api/training/**")
            .addFilterBefore(new TrainingCookieFilter(auth),UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new TrainingLimitsFilter(limiter),TrainingCookieFilter.class)
            .csrf(c->c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                .requireCsrfProtectionMatcher(r->!Set.of("GET","HEAD","OPTIONS","TRACE").contains(r.getMethod())&&(r.getHeader("Authorization")==null||r.getHeader("Authorization").isBlank())))
            .formLogin(AbstractHttpConfigurer::disable).httpBasic(AbstractHttpConfigurer::disable).logout(AbstractHttpConfigurer::disable)
            .requestCache(AbstractHttpConfigurer::disable).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e->e.authenticationEntryPoint((request,response,failure)->{response.setStatus(401);response.setContentType("application/json");response.getWriter().write("{\"code\":\"SIGN_IN_REQUIRED\"}");}))
            .authorizeHttpRequests(a->a.requestMatchers("/api/training/auth/csrf","/api/training/auth/login","/api/training/auth/signup","/api/training/auth/logout").permitAll().anyRequest().authenticated()).build();
    }
}
