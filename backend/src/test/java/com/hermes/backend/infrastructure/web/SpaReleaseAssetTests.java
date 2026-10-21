package com.hermes.backend.infrastructure.web;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

class SpaReleaseAssetTests {
    @Test
    void shellAndAssetsUseTheSameClasspathEvenWhenAnotherBuildExistsOnDisk() throws Exception {
        String expected;
        try (var input=SpaForwardingController.class.getResourceAsStream("/static/index.html")) {
            expected=new String(input.readAllBytes(),StandardCharsets.UTF_8);
        }
        var diskIndex=Path.of("target","classes","static","index.html");
        try (var files=mockStatic(Files.class,CALLS_REAL_METHODS)) {
            files.when(()->Files.isRegularFile(diskIndex)).thenReturn(true);
            files.when(()->Files.readString(diskIndex,StandardCharsets.UTF_8)).thenReturn("<html>Different build with unavailable hashed assets</html>");
            var request=new MockHttpServletRequest("GET","/schedule");
            assertThat(new SpaForwardingController().forward(request).getBody()).isEqualTo(expected);
        }
    }
}
