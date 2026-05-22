package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class GpxExportService {

    String exportTrack(String raceName, String description, List<RawBreadcrumbPointDTO> breadcrumbs) {
        if (raceName == null || raceName.isBlank()) {
            throw new IllegalArgumentException("Race name is required.");
        }
        if (breadcrumbs == null || breadcrumbs.isEmpty()) {
            throw new IllegalArgumentException("At least one breadcrumb is required.");
        }

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<gpx version=\"1.1\" creator=\"Hermes\" xmlns=\"http://www.topografix.com/GPX/1/1\">\n");
        xml.append("  <trk>\n");
        xml.append("    <name>").append(escapeXml(raceName.strip())).append("</name>\n");
        if (description != null && !description.isBlank()) {
            xml.append("    <desc>").append(escapeXml(description.strip())).append("</desc>\n");
        }
        xml.append("    <trkseg>\n");
        for (RawBreadcrumbPointDTO breadcrumb : breadcrumbs) {
            RawBreadcrumbPointDTO point = Objects.requireNonNull(breadcrumb, "Breadcrumb entries must not be null.");
            xml.append("      <trkpt lat=\"")
                    .append(formatCoordinate(point.latitude()))
                    .append("\" lon=\"")
                    .append(formatCoordinate(point.longitude()))
                    .append("\"></trkpt>\n");
        }
        xml.append("    </trkseg>\n");
        xml.append("  </trk>\n");
        xml.append("</gpx>\n");
        return xml.toString();
    }

    private String formatCoordinate(double value) {
        return String.format(Locale.US, "%.6f", value);
    }

    private String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
