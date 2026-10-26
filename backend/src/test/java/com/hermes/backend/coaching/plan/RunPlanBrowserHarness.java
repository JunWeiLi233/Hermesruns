package com.hermes.backend.coaching.plan;

import com.hermes.backend.BackendApplication;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.*;
import org.springframework.boot.SpringApplication;

/** Explicit local-only browser fixture. Test classpath only; cannot connect to an account database. */
public class RunPlanBrowserHarness {
    public static void main(String[] ignored) {
        if(!Boolean.getBoolean("hermes.plan.browser-harness"))throw new IllegalStateException("Explicit local harness flag required");
        System.setProperty("spring.devtools.restart.enabled","false");
        int port=Integer.getInteger("hermes.plan.browser-port",4320);
        String approval=System.getProperty("hermes.plan.browser-approval", "");
        var context=SpringApplication.run(BackendApplication.class,
            "--server.address=127.0.0.1","--server.port="+port,
            "--spring.datasource.url=jdbc:h2:mem:plan-browser;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
            "--spring.datasource.driver-class-name=org.h2.Driver","--spring.datasource.username=sa","--spring.datasource.password=",
            "--spring.jpa.hibernate.ddl-auto=create-drop","--app.mail.provider=disabled",
            "--app.official-course.startup-seed.enabled=false","--app.course-map.bulk-seed.enabled=false",
            "--app.run-plans.approved-ruleset="+approval,"--logging.level.root=WARN");
        var runners=context.getBean(RunnerRepository.class);var auth=context.getBean(AuthService.class);
        var runner=new Runner("plan-browser@hermes.test","active");runner.setDisplayName("Alex Morgan");runner.setTimeZone("America/New_York");runner.setEmailVerified(true);
        auth.storePassword(runner,"Hermes-test-only-4320!");runners.saveAndFlush(runner);
        for(int n=1;n<=64;n++) {
            var other=new Runner("plan-qa-"+n+"@hermes.test","active");other.setDisplayName("QA runner "+n);other.setTimeZone("America/New_York");other.setEmailVerified(true);
            auth.storePassword(other,"Hermes-test-only-4320!");runners.saveAndFlush(other);
        }
        if(Boolean.getBoolean("hermes.plan.pace-fixtures"))for(int n:java.util.List.of(46,47,48))RunPlanPaceFixture.seed(
            context.getBean(RunPlanService.class),context.getBean(org.springframework.transaction.PlatformTransactionManager.class),runners.findByEmailIgnoreCase("plan-qa-"+n+"@hermes.test").orElseThrow(),n==48);
        System.out.println("Local plan browser fixture ready at http://127.0.0.1:"+port+"/training-plan; approval="+approval);
    }
}
