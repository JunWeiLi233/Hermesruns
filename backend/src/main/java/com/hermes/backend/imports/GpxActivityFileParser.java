package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityTypeResolver;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

@Component
public class GpxActivityFileParser extends AbstractXmlActivityFileParser {
    @Override
    public boolean supports(String fileExtension) {
        return "GPX".equalsIgnoreCase(fileExtension);
    }

    @Override
    public ParsedActivityData parse(String fileName, byte[] fileBytes) {
        Document document = parseDocument(fileBytes);
        List<Element> trackPoints = elementsByLocalName(document, "trkpt");
        if (trackPoints.isEmpty()) {
            throw new IllegalArgumentException("The GPX file does not contain any track points.");
        }

        List<ParsedTrackPoint> points = new ArrayList<>();
        LocalDateTime startTime = null;
        LocalDateTime endTime = null;

        for (Element trackPoint : trackPoints) {
            Double latitude = parseDouble(trackPoint.getAttribute("lat"));
            Double longitude = parseDouble(trackPoint.getAttribute("lon"));
            if (latitude == null || longitude == null) {
                continue;
            }

            LocalDateTime trackPointTime = parseDateTime(firstTextByLocalName(trackPoint, "time"));
            if (trackPointTime != null) {
                if (startTime == null) {
                    startTime = trackPointTime;
                }
                endTime = trackPointTime;
            }

            Integer elapsedSeconds = null;
            if (startTime != null && trackPointTime != null) {
                long sec = java.time.Duration.between(startTime, trackPointTime).getSeconds();
                if (sec >= 0 && sec <= Integer.MAX_VALUE) {
                    elapsedSeconds = (int) sec;
                }
            }

            Double elevationMeters = parseDouble(firstTextByLocalName(trackPoint, "ele"));
            Integer heartRate = parseFirstInt(trackPoint,
                    "hr", "heartrate", "gpxtpx:hr", "ns3:hr", "TrackPointExtension/hr");
            Integer cadence = parseFirstInt(trackPoint,
                    "cad", "gpxtpx:cad", "ns3:cad", "TrackPointExtension/cad");
            Double groundContactTimeMs = parseFirstPositiveDouble(trackPoint,
                    "GroundContactTime", "GroundContactTimeMs", "StanceTime", "stance_time", "ground_contact_time");
            Double verticalOscillationMm = parseFirstPositiveDouble(trackPoint,
                    "VerticalOscillation", "VerticalOscillationMm", "vertical_oscillation");

            points.add(new ParsedTrackPoint(
                    latitude,
                    longitude,
                    elapsedSeconds,
                    null,
                    elevationMeters,
                    heartRate,
                    cadence,
                    groundContactTimeMs,
                    verticalOscillationMm
            ));
        }

        if (points.isEmpty()) {
            throw new IllegalArgumentException("The GPX file does not contain any valid coordinates.");
        }

        String activityName = resolveName(document, fileName);
        Double distanceMeters = (double) estimateDistanceMeters(points);
        Long durationSeconds = durationSeconds(startTime, endTime);
        return new ParsedActivityData(
                activityName,
                ActivityTypeResolver.fromSportLabels(firstTypeLabel(document), activityName, fileName),
                startTime,
                distanceMeters,
                durationSeconds,
                points,
                null,
                null
        );
    }

    /**
     * GPX 1.1 carries an optional {@code <type>} under {@code <trk>} (Strava and
     * Coros exports set it). Falls back to {@code <metadata><type>}. Combined with
     * the track name and file name in {@link ActivityTypeResolver#fromSportLabels},
     * named running exports ("Morning Run") import without an explicit type, while
     * labeled non-runs ("Ride") are skipped and unlabeled generic files stay
     * UNKNOWN and are rejected by the import layer.
     */
    private String firstTypeLabel(Document document) {
        List<Element> trackElements = elementsByLocalName(document, "trk");
        if (!trackElements.isEmpty()) {
            String trackType = firstTextByLocalName(trackElements.get(0), "type");
            if (trackType != null && !trackType.isBlank()) {
                return trackType;
            }
        }
        List<Element> metadataElements = elementsByLocalName(document, "metadata");
        if (!metadataElements.isEmpty()) {
            String metadataType = firstTextByLocalName(metadataElements.get(0), "type");
            if (metadataType != null && !metadataType.isBlank()) {
                return metadataType;
            }
        }
        return null;
    }

    private String resolveName(Document document, String fileName) {
        List<Element> metadataElements = elementsByLocalName(document, "metadata");
        if (!metadataElements.isEmpty()) {
            String metadataName = firstTextByLocalName(metadataElements.get(0), "name");
            if (metadataName != null && !metadataName.isBlank()) {
                return metadataName;
            }
        }

        List<Element> trackElements = elementsByLocalName(document, "trk");
        if (!trackElements.isEmpty()) {
            String trackName = firstTextByLocalName(trackElements.get(0), "name");
            if (trackName != null && !trackName.isBlank()) {
                return trackName;
            }
        }

        return fileNameStem(fileName);
    }

    private Integer parseFirstInt(Element parent, String... keys) {
        for (String k : keys) {
            String v = firstTextByLocalNamePathAware(parent, k);
            if (v == null || v.isBlank()) continue;
            try {
                int n = (int) Math.round(Double.parseDouble(v.trim()));
                if (n > 0) return n;
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String firstTextByLocalNamePathAware(Element parent, String key) {
        if (key.contains("/")) {
            String[] parts = key.split("/");
            Element cur = parent;
            for (String p : parts) {
                if (cur == null) return null;
                String local = p.contains(":") ? p.substring(p.indexOf(':') + 1) : p;
                cur = firstChildElementByLocalName(cur, local);
            }
            return cur == null ? null : cur.getTextContent();
        }
        String local = key.contains(":") ? key.substring(key.indexOf(':') + 1) : key;
        return firstTextByLocalName(parent, local);
    }

    private Double parseFirstPositiveDouble(Element parent, String... localNames) {
        for (String localName : localNames) {
            var nodes = parent.getElementsByTagNameNS("*", localName);
            for (int index = 0; index < nodes.getLength(); index += 1) {
                if (nodes.item(index) instanceof Element element) {
                    Double value = parseDouble(element.getTextContent());
                    if (value != null && value > 0 && Double.isFinite(value)) {
                        return value;
                    }
                }
            }
        }
        return null;
    }
}
