package com.hermes.backend.training;

import com.hermes.backend.auth.*;
import com.hermes.backend.runner.Runner;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.*;
import org.springframework.http.ResponseEntity;
import jakarta.servlet.http.Cookie;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TrainingCookieTests extends TrainingFixture {
 @Test void loginKeepsExistingIdentityAndMovesTokenToSecureHttpOnlyCookie(){
  var auth=mock(AuthService.class);var login=mock(LoginController.class);var r=new Runner();r.setId(1L);r.setDisplayName("Athlete Sample");
  var request=new MockHttpServletRequest();var response=new MockHttpServletResponse();var body=Map.<String,Object>of("email","sample@example.test","password","test-only-input");
  doReturn(ResponseEntity.ok(Map.of("token","opaque-test-token","role","USER"))).when(login).login(body,request);
  when(auth.findByAuthorizationHeader("Bearer opaque-test-token")).thenReturn(Optional.of(r));
  var controller=new TrainingAuthController(login,auth,db,true);
  var result=controller.login(body,request,response);
  assertThat(result.getBody().toString()).doesNotContain("opaque-test-token");
  assertThat(response.getHeader("Set-Cookie")).contains("HttpOnly","Secure","SameSite=Strict","Path=/api/training");
 }
 @Test void adminChallengeNeverCreatesAnOrdinarySession(){
  var login=mock(LoginController.class);var request=new MockHttpServletRequest();var response=new MockHttpServletResponse();var body=Map.<String,Object>of("email","admin@example.test","password","test-only-input");
  doReturn(ResponseEntity.ok(Map.of("mfaRequired",true))).when(login).login(body,request);
  var result=new TrainingAuthController(login,mock(AuthService.class),db,true).login(body,request,response);
  assertThat(response.getHeader("Set-Cookie")).isNull();assertThat(result.getBody().toString()).contains("mfaRequired");
 }
 @Test void cookieCannotOverrideAnInvalidExplicitBearerCredential() throws Exception {
  var auth=mock(AuthService.class);when(auth.findByAuthorizationHeader("Bearer invalid")).thenReturn(Optional.empty());
  var request=new MockHttpServletRequest("GET","/api/training/me");request.addHeader("Authorization","Bearer invalid");request.setCookies(new Cookie("hermes_training","valid-cookie"));
  var response=new MockHttpServletResponse();var filter=new TrainingCookieFilter(auth);
  filter.doFilter(request,response,(req,res)->assertThat(org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()).isNull());
  verify(auth,never()).findByAuthorizationHeader("Bearer valid-cookie");
 }
}
