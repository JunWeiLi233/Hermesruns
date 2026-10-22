package com.hermes.backend.training;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.security.web.FilterChainProxy;
import jakarta.servlet.http.Cookie;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:workspace-http;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE","spring.datasource.driver-class-name=org.h2.Driver","spring.jpa.hibernate.ddl-auto=create-drop","app.training-workspace.enabled=true","app.training-workspace.migrate=true","app.training-workspace.cookie-secure=false","app.official-course.startup-seed.enabled=false","strava.sync.enabled=false","garmin.wellness.sync.enabled=false","app.coach.nightly.enabled=false","app.local-shared-runner.enabled=false"})
class TrainingHttpTests {
 @Autowired WebApplicationContext context;@Autowired FilterChainProxy security;@Autowired RunnerRepository runners;@Autowired AuthService auth;@Autowired TrainingStore db;@Autowired ObjectMapper json;
 MockMvc mvc;Runner owner,other;String token,actor,otherId;
 @BeforeEach void setup(){mvc=MockMvcBuilders.webAppContextSetup(context).addFilters(security).build();owner=user();other=user();token=auth.issueSessionToken(owner);actor=db.ensure(owner.getId(),"Owner","UTC");otherId=db.ensure(other.getId(),"Other","UTC");}
 Runner user(){var r=new Runner("training-http-"+UUID.randomUUID()+"@example.test","active");r.setEmailVerified(true);auth.storePassword(r,"Synthetic-Test-Only-129!");return runners.saveAndFlush(r);}
 @Test void unauthenticatedAndForeignAthleteReadsAreDenied()throws Exception{
  mvc.perform(get("/api/training/me")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/training/me").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(actor));
  mvc.perform(get("/api/training/athletes/"+otherId+"/activities").header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
 }
 @Test void existingHermesSessionOpensCookieWorkspaceAndGlobalLogoutClosesIt()throws Exception{
  var response=mvc.perform(post("/api/training/auth/session").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(actor)).andReturn().getResponse();
  assertThat(response.getContentAsString()).doesNotContain(token);assertThat(response.getHeaders("Set-Cookie").toString()).contains("hermes_training=","HttpOnly","SameSite=Strict");
  Cookie cookie=response.getCookie("hermes_training");mvc.perform(get("/api/training/me").cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(actor));
  mvc.perform(post("/api/auth/logout").header("Authorization","Bearer "+token)).andExpect(status().isOk());
  mvc.perform(get("/api/training/me").cookie(cookie)).andExpect(status().isUnauthorized());
 }
 @Test void nativeTrainingDeepLinksServeTheProductShellWithoutExposingData()throws Exception{
  mvc.perform(get("/training/")).andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("text/html"));
  mvc.perform(get("/training/calendar")).andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("text/html")).andExpect(header().string("X-Robots-Tag","noindex, nofollow, noarchive"));
  mvc.perform(get("/api/training/me")).andExpect(status().isUnauthorized());
 }
 @Test void cookieMutationsRequireCsrfAndExplicitInvalidBearerCannotBypassIt()throws Exception{
  Cookie session=new Cookie("hermes_training",token);
  mvc.perform(post("/api/training/teams").cookie(session).contentType("application/json").content("{\"name\":\"Original group\"}")).andExpect(status().isForbidden());
  mvc.perform(post("/api/training/teams").cookie(session).header("Authorization","Bearer invalid").header("Idempotency-Key",UUID.randomUUID().toString()).contentType("application/json").content("{\"name\":\"Original group\"}")).andExpect(status().isUnauthorized());
 }
 @Test void csrfBootstrapAndCookieLoginNeverExposeTheSessionToken()throws Exception{
  var csrf=mvc.perform(get("/api/training/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse();
  String value=json.readTree(csrf.getContentAsString()).get("token").asText();
  var login=mvc.perform(post("/api/training/auth/login").cookie(csrf.getCookies()).header("X-TRAINING-CSRF",value).contentType("application/json").content(json.writeValueAsString(Map.of("email",owner.getEmail(),"password","Synthetic-Test-Only-129!")))).andExpect(status().isOk()).andReturn().getResponse();
  assertThat(login.getContentAsString()).doesNotContain("token");assertThat(login.getHeaders("Set-Cookie").toString()).contains("hermes_training=","HttpOnly","SameSite=Strict");
 }
 @Test void realHttpManualAndPrescriptionRoundTripUsesIdempotency()throws Exception{
  String key=UUID.randomUUID().toString(),path="/api/training/athletes/"+actor+"/activities/manual";String body="{\"title\":\"Original manual session\",\"date\":\"2026-10-14\",\"minutes\":20,\"sport\":\"Running\",\"rpe\":3}";
  var first=mvc.perform(post(path).header("Authorization","Bearer "+token).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isOk()).andReturn().getResponse();
  var second=mvc.perform(post(path).header("Authorization","Bearer "+token).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isOk()).andReturn().getResponse();
  assertThat(json.readTree(second.getContentAsString()).get("id")).isEqualTo(json.readTree(first.getContentAsString()).get("id"));
  mvc.perform(get("/api/training/athletes/"+actor+"/calendar").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.activities.length()").value(1));
 }
 @Test void oversizedJsonIsRejectedBeforeDeserialization()throws Exception{
  mvc.perform(post("/api/training/teams").header("Authorization","Bearer "+token).header("Idempotency-Key",UUID.randomUUID().toString()).contentType("application/json").content(json.writeValueAsString(Map.of("name","x".repeat(262145))))).andExpect(status().isPayloadTooLarge());
 }
}
