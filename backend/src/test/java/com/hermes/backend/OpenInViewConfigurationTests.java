package com.hermes.backend;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Production runs with spring.jpa.open-in-view=false. The test application.properties has the same name as the main one,
 * so on the test classpath it shadows it and none of the main settings reach the tests. If it did not say the same, a lazy
 * association read outside a transaction would work here and throw LazyInitializationException in production.
 */
class OpenInViewConfigurationTests {

    @Test
    void theMainAndTheTestApplicationPropertiesBothTurnOpenInViewOff() throws IOException {
        // Both files are folders on the test classpath (target/test-classes and target/classes); a jar's copy is not ours.
        List<URL> ours = Collections.list(getClass().getClassLoader().getResources("application.properties")).stream()
                .filter(url -> "file".equals(url.getProtocol()))
                .toList();

        assertThat(ours).as("the test and the main application.properties").hasSize(2);
        for (URL file : ours) {
            Properties properties = new Properties();
            try (InputStream in = file.openStream()) {
                properties.load(in);
            }
            assertThat(properties.getProperty("spring.jpa.open-in-view")).as(file.toString()).isEqualTo("false");
        }
    }
}
