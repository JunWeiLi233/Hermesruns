package com.hermes.backend.explorer;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.infrastructure.mail.*;
import com.hermes.backend.runner.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static com.hermes.backend.explorer.ExplorerJson.*;

/** Test classpath only. Never compiled into the application jar or enabled in a deployed runtime. */
@TestConfiguration(proxyBeanMethods=false)
public class ExplorerBrowserFixtures {
    static class State {
        final String key=secret();final String password="Invented!"+secret().substring(0,24);
        final List<TransactionalMailMessage> messages=new CopyOnWriteArrayList<>();
    }
    @Bean State browserState(){return new State();}
    @RestController
    @Profile("explorer-browser-fixtures")
    @RequestMapping("/api/explorer/public/test")
    class Endpoints {
        private final State state;private final RunnerRepository runners;private final AuthService auth;private final JdbcTemplate jdbc;
        private final ExplorerImports imports;private final ExplorerWorker worker;private final TransactionalMailSender sender;
        Endpoints(State state,RunnerRepository runners,AuthService auth,JdbcTemplate jdbc,ExplorerImports imports,ExplorerWorker worker,TransactionalMailSender sender){this.state=state;this.runners=runners;this.auth=auth;this.jdbc=jdbc;this.imports=imports;this.worker=worker;this.sender=sender;}
        private void check(String key){if(!state.key.equals(key))throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
        @PostMapping("/reset") Map<String,Object> reset(@RequestHeader("X-Explorer-Test-Key") String key,@RequestBody Map<String,Object> body)throws Exception {
            check(key);
            if(!Objects.toString(System.getenv("EXPLORER_TEST_JDBC_URL"),"").matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/explorer_backend_test"))throw new IllegalStateException("Synthetic database required.");
            jdbc.execute("TRUNCATE public.runner CASCADE");jdbc.execute("TRUNCATE statshunters.deletion_requests");state.messages.clear();
            org.mockito.Mockito.reset(sender);when(sender.isConfigured()).thenReturn(true);when(sender.send(any())).thenAnswer(call->{state.messages.add(call.getArgument(0));return null;});
            Runner owner=runner("qa.owner@example.test");runner("qa.other@example.test");
            if(!Boolean.FALSE.equals(body.get("activities"))) {
                List<org.springframework.web.multipart.MultipartFile> files=List.of(gpx("Invented café 🚲","cycling","2026-11-01T05:30:00Z",0),gpx("Invented dawn run","running","2026-11-01T03:30:00Z",.01),gpx("Invented late walk","walking","2026-11-02T04:30:00Z",.02));
                imports.enqueue(owner,files,true,"browser-seed-key");worker.tick();
            }
            return map("ready",true);
        }
        private Runner runner(String email){Runner runner=new Runner(email,"ACTIVE");runner.setEmailVerified(true);runner.setTimeZone("America/New_York");auth.storePassword(runner,state.password);return runners.saveAndFlush(runner);}
        private MockMultipartFile gpx(String name,String sport,String time,double offset){String source="<gpx xmlns=\"http://www.topografix.com/GPX/1/1\"><trk><name>"+name+"</name><type>"+sport+"</type><trkseg><trkpt lat=\"40.75\" lon=\""+(-73.98+offset)+"\"><time>"+time+"</time><ele>10</ele></trkpt><trkpt lat=\"40.76\" lon=\""+(-73.97+offset)+"\"><time>"+java.time.Instant.parse(time).plusSeconds(600)+"</time><ele>20</ele></trkpt></trkseg></trk></gpx>";return new MockMultipartFile("files",name.replaceAll("[^a-zA-Z]","")+".gpx","application/gpx+xml",source.getBytes(StandardCharsets.UTF_8));}
        @PostMapping("/tick") Map<String,Object> tick(@RequestHeader("X-Explorer-Test-Key") String key){check(key);worker.tick();return map("processed",true);}
        @PostMapping("/expire") Map<String,Object> expire(@RequestHeader("X-Explorer-Test-Key") String key){check(key);runners.findByEmailIgnoreCase("qa.owner@example.test").ifPresent(auth::invalidateSession);return map("expired",true);}
        @PostMapping("/calendar") Map<String,Object> calendar(@RequestHeader("X-Explorer-Test-Key") String key,@RequestBody Map<String,Object> body){check(key);String zone=java.time.ZoneId.of(body.get("zone").toString()).getId();Runner runner=runners.findByEmailIgnoreCase("qa.owner@example.test").orElseThrow();runner.setTimeZone(zone);runners.saveAndFlush(runner);return map("changed",true);}
        @PostMapping("/mail") List<Map<String,Object>> mail(@RequestHeader("X-Explorer-Test-Key") String key){check(key);return state.messages.stream().map(message->map("to",message.to(),"subject",message.subject(),"text",message.text())).toList();}
    }
}
