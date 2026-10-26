package com.hermes.backend.races;
import java.nio.file.Path;
import java.util.Base64;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;

class CourseMapPdfMemoryTests {
    @Test
    void largeFormatOfficialPdfCanBeUploadedInABoundedWorkerHeap() throws Exception {
        var process=new ProcessBuilder(Path.of(System.getProperty("java.home"),"bin","java").toString(),"-Xmx256m","-cp",
                System.getProperty("java.class.path"),Probe.class.getName()).redirectErrorStream(true).start();
        boolean complete=process.waitFor(45,TimeUnit.SECONDS);
        if(!complete)process.destroyForcibly();
        assertThat(complete).as("PDF worker finishes within45seconds").isTrue();
        String output=new String(process.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
        assertThat(process.exitValue()).as(output).isZero();
        assertThat(output).contains("PDF upload passed");
    }
    public static class Probe {
        public static void main(String[] args)throws Exception {
            byte[] pdf=Probe.class.getResourceAsStream("/course-maps/honolulu-2026.pdf").readAllBytes();
            var result=new RaceCourseMapImageService(new RestTemplate()).resolveUploadedReference("data:application/pdf;base64,"+Base64.getEncoder().encodeToString(pdf));
            if(result==null)throw new IllegalStateException("PDF unreadable");
            var image=ImageIO.read(new ByteArrayInputStream(result.imageBytes()));
            if(image==null || Math.max(image.getWidth(),image.getHeight())>1800)throw new IllegalStateException("Unbounded preview");
            System.out.println("PDF upload passed");
        }
    }
}
