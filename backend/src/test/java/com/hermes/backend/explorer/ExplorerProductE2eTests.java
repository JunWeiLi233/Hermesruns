package com.hermes.backend.explorer;

import com.hermes.backend.infrastructure.mail.TransactionalMailSender;
import java.nio.file.*;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="EXPLORER_TEST_JDBC_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/explorer_backend_test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "spring.profiles.active=explorer-browser-fixtures","server.address=127.0.0.1","app.explorer.enabled=true","app.explorer.cookie-secure=false",
    "app.explorer.worker-delay-ms=86400000","spring.jpa.hibernate.ddl-auto=create-drop","spring.datasource.driver-class-name=org.postgresql.Driver",
    "strava.sync.enabled=false","garmin.wellness.sync.enabled=false","app.coach.nightly.enabled=false","app.local-shared-runner.enabled=false",
    "app.training-workspace.enabled=false","app.email-validation.dns-enabled=false","hermes.environment=development",
    "APP_DATA_ENCRYPTION_KEY=synthetic-explorer-browser-key-only","recaptcha.secret-key=","recaptcha.site-key=",
    "spring.servlet.multipart.max-file-size=50MB","spring.servlet.multipart.max-request-size=101MB"
})
@Import(ExplorerBrowserFixtures.class)
class ExplorerProductE2eTests {
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties){properties.add("spring.datasource.url",()->System.getenv("EXPLORER_TEST_JDBC_URL"));properties.add("spring.datasource.username",()->"explorer_test");properties.add("spring.datasource.password",()->"");}
    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ExplorerBrowserFixtures.State state;
    @MockitoBean TransactionalMailSender sender;
    @Test void integratedProductFlows()throws Exception {
        assertThat(System.getenv("EXPLORER_TEST_JDBC_URL")).matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/explorer_backend_test");
        new org.springframework.jdbc.core.JdbcTemplate(dataSource).execute("DROP SCHEMA IF EXISTS statshunters CASCADE");
        new ResourceDatabasePopulator(new ClassPathResource("explorer-migrations/V001__explorer_r0_r1.sql")).execute(dataSource);
        // The native Hermes workspace is the shipped product. The separately built prototype remains opt-in.
        boolean nativeMode=Boolean.parseBoolean(System.getProperty("explorer.e2e.native","true"));
        Path repo=Path.of("..").toAbsolutePath().normalize(),e2e=repo.resolve("replica/statshunters/app/e2e"),log=repo.resolve("replica/statshunters/validation/"+(nativeMode?"native-playwright.log":"product-playwright.log"));
        Files.createDirectories(log.getParent());
        Path testIndex=null;byte[] previousIndex=null;
        if(nativeMode) {
            // MVC unit tests intentionally ship a tiny, script-free SPA fixture.
            // Browser acceptance must serve the actual production shell instead.
            testIndex=Path.of(getClass().getResource("/static/index.html").toURI()).toAbsolutePath().normalize();
            Path testClasses=Path.of(ExplorerProductE2eTests.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toAbsolutePath().normalize();
            assertThat(testIndex).startsWith(testClasses);
            Path productionClasses=Path.of(com.hermes.backend.BackendApplication.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toAbsolutePath().normalize();
            Path productionIndex=productionClasses.resolve("static/index.html");
            assertThat(Files.readString(productionIndex)).contains("/assets/");
            previousIndex=Files.readAllBytes(testIndex);
            Files.copy(productionIndex,testIndex,StandardCopyOption.REPLACE_EXISTING);
        }
        try {
        String node=System.getenv().getOrDefault("EXPLORER_NODE_BINARY",Path.of(System.getenv("ProgramFiles"),"nodejs","node.exe").toString());
        ProcessBuilder builder=new ProcessBuilder(node,e2e.resolve("node_modules/@playwright/test/cli.js").toString(),"test","--config="+(nativeMode?"native.config.js":"playwright.config.js")).directory(e2e.toFile()).redirectErrorStream(true).redirectOutput(log.toFile());
        builder.environment().put("EXPLORER_E2E_URL","http://127.0.0.1:"+port);builder.environment().put("EXPLORER_E2E_KEY",state.key);builder.environment().put("EXPLORER_E2E_PASSWORD",state.password);
        Process process=builder.start();boolean done=process.waitFor(20,java.util.concurrent.TimeUnit.MINUTES);if(!done)process.destroyForcibly();
        assertThat(done).as("Playwright completed within its bounded test timeout; see product-playwright.log").isTrue();
        assertThat(process.exitValue()).as("Integrated browser suite; see product-playwright.log and product-e2e-results.json").isZero();
        } finally {
            if(previousIndex!=null) Files.write(testIndex,previousIndex);
        }
    }
}
