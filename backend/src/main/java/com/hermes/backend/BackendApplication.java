package com.hermes.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {
    // Read by StartupPhaseDiagnosticsLogger on ApplicationReadyEvent. Assigned in main(),
    // which devtools re-invokes on every restart, so it always matches the live context.
    static BufferingApplicationStartup applicationStartup;

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(BackendApplication.class);
        BufferingApplicationStartup startup = new BufferingApplicationStartup(8192);
        applicationStartup = startup;
        application.setApplicationStartup(startup);
        application.run(args);
    }

}
