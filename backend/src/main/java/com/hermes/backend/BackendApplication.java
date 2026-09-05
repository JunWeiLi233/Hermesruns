package com.hermes.backend;

import java.util.Arrays;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.metrics.buffering.BufferingApplicationStartup;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {
    // Read by StartupPhaseDiagnosticsLogger on ApplicationReadyEvent. Assigned in main(),
    // which devtools re-invokes on every restart, so it always matches the live context.
    // Null in production — main() skips the buffer there to trim the runtime footprint.
    static BufferingApplicationStartup applicationStartup;

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(BackendApplication.class);
        if (!runsInProduction(args)) {
            BufferingApplicationStartup startup = new BufferingApplicationStartup(8192);
            applicationStartup = startup;
            application.setApplicationStartup(startup);
        }
        application.run(args);
    }

    // Railway launches the jar with SPRING_PROFILES_ACTIVE=production (no program args);
    // --spring.profiles.active=... program args and the -Dspring.profiles.active system
    // property are honored too so local runs match.
    private static boolean runsInProduction(String[] args) {
        if (containsProductionProfile(System.getenv("SPRING_PROFILES_ACTIVE"))
                || containsProductionProfile(System.getProperty("spring.profiles.active"))) {
            return true;
        }
        for (String arg : args) {
            if (arg.startsWith("--spring.profiles.active=")
                    && containsProductionProfile(arg.substring("--spring.profiles.active=".length()))) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsProductionProfile(String profiles) {
        return profiles != null
                && Arrays.stream(profiles.split(",")).map(String::trim).anyMatch("production"::equals);
    }

}
